// x87 values that carry more than double precision.
//
// Why (evidence): Watcom's FPU init 0x25e4a loads the control word from [0x31784] = 0x127F via 0x2c640
// (fninit ... fldcw [esp], 0x2c65d): precision control = 53 bits, rounding = nearest. So every
// FADD/FSUB/FMUL/FDIV/FDIVR result is rounded once to double precision — exactly what JS arithmetic on
// doubles does (except for subnormal results, see below). FPATAN, FSIN and FCOS are NOT affected by
// precision control: their results keep a 64-bit mantissa in ST0. The game uses such a result before
// storing it, e.g. 0x11e47 `call cos` then 0x11e5a `fmul qword [0x30164]` (-5.0): the x87 rounds the exact
// product (64-bit cos x double) once, while `Math.cos(x) * -5` rounds twice. That changes stored
// velocities and, at ratios like 4/3, the integer positions derived from them (confirmed: audit round1
// F-risky, x87/sens_naive.mjs — 89 reachable (num, den) pairs change 0x12130 integer positions).
//
// Model: an Ext is an exact binary value m * 2^e (m BigInt, e integer). The trig functions of the CRT
// (lib/crt.js) return Ext values holding the correctly rounded 64-bit-mantissa result (see the note above
// GUARD below: real FPUs are only faithful, the choice is not game-observable).
// Operations (PC = 53, RC = nearest): the exact result of the operation is rounded ONCE to 53 bits, so
// they return plain JS numbers. With two double operands they are ordinary JS arithmetic.
//   fmul(a, b)  fadd(a, b)  fsub(a, b) = a - b   fdiv(a, b) = a / b   (FDIVR/FSUBR: swap the operands)
//   fchs(a)     exact negation (Ext stays Ext)
//   toDouble(a) FSTP qword: round the register value directly to double (one rounding, also for subnormals)
//   toFloat(a)  FSTP dword: round the register value directly to single (one rounding, not via double)
//   chp(a)      __CHP 0x222a4: FRNDINT with RC = chop -> truncation toward zero (exact integer)
//   cmp(a, b)   FCOM-style comparison of exact values: -1, 0, 1
// Not modelled: infinities/NaN inside an Ext, exceptions.
// Subnormal results (below 2^-1022; LATENT — game values are about 0.1..400, audit round1 F-risky F4):
//   the x87 rounds an arithmetic result to 53 bits with the EXTENDED exponent range (PC = 53) and only the
//   FST m64 denormalizes it — a second rounding. fmul/fadd/fsub/fdiv with an Ext operand reproduce that
//   (roundBits 53, then toDouble). Plain JS arithmetic on two doubles (the fast path below and ordinary JS
//   operators in game code) rounds ONCE, directly to the subnormal, so it can differ in the last bit there.
//   An FSTP of a 64-bit trig result rounds once, as toDouble/toFloat do.
// Sign of zero (LATENT, F-risky F3): an Ext zero has no sign (BigInt 0n). fromDouble(-0), sin64(-0),
//   atan64(-0), fchs(+0) and chp of an Ext in (-1, 0) give +0, and fdiv(0, y) takes only y's sign, where
//   the x87 gives -0 (FSIN(-0) = -0, -0/5 = -0, FRNDINT keeps the operand's sign). Unreachable: the only
//   trig arguments are atan(num/den) with an int num (a zero quotient is +0) and those atan results; a zero
//   only reaches __CHP + fistp (sign-free integer) in 0x1977e, and 0x11c2a stores sin as a plain double
//   first, after which `s * K` is plain JS with the correct sign.

export class Ext {
  constructor(m, e) { this.m = m; this.e = e; } // value = m * 2^e (m: BigInt)
}
export const isExt = (v) => v instanceof Ext;

const dv = new DataView(new ArrayBuffer(8));

// exact decomposition of a finite double
export function fromDouble(x) {
  if (!Number.isFinite(x)) throw new Error('x87: non-finite value in extended arithmetic');
  if (x === 0) return new Ext(0n, 0);
  dv.setFloat64(0, x);
  const hi = dv.getUint32(0), lo = dv.getUint32(4);
  const exp = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e;
  if (exp === 0) e = -1074;
  else { m |= 1n << 52n; e = exp - 1075; }
  if (x < 0) m = -m;
  return new Ext(m, e);
}
const toExt = (v) => (v instanceof Ext ? v : fromDouble(v));

function bitLength(m) { // m > 0
  return m.toString(2).length;
}

// round m*2^e to `bits` significant bits, nearest-even; returns Ext
export function roundBits(m, e, bits) {
  if (m === 0n) return new Ext(0n, 0);
  const neg = m < 0n;
  let a = neg ? -m : m;
  const sh = bitLength(a) - bits;
  if (sh > 0) {
    const s = BigInt(sh);
    const q = a >> s;
    const r = a - (q << s);
    const half = 1n << (s - 1n);
    let qq = q;
    if (r > half || (r === half && (q & 1n))) qq = q + 1n;
    a = qq;
    e += sh;
  }
  return new Ext(neg ? -a : a, e);
}

function extToNumber(x) { // x has <= 53 significant bits
  if (x.m === 0n) return 0;
  let n = Number(x.m);
  let e = x.e;
  // scale in steps so intermediate powers stay finite
  while (e > 1000) { n *= 2 ** 1000; e -= 1000; }
  while (e < -1000) { n *= 2 ** -1000; e += 1000; }
  return n * 2 ** e;
}

// round m*2^e ONCE to a binary format with `bits` significand bits whose smallest quantum is 2^qmin
// (IEEE gradual underflow: below the normal range fewer bits are kept); nearest-even; returns Ext
function roundFormat(m, e, bits, qmin) {
  if (m === 0n) return new Ext(0n, 0);
  const neg = m < 0n;
  const a = neg ? -m : m;
  if (bitLength(a) + e - bits >= qmin) return roundBits(m, e, bits); // normal: lsb exponent >= qmin
  const sh = qmin - e; // subnormal: round to a multiple of 2^qmin
  if (sh <= 0) return new Ext(m, e); // already a multiple of 2^qmin: exact
  const s = BigInt(sh);
  const q = a >> s;
  const r = a - (q << s);
  const half = 1n << (s - 1n);
  const qq = r > half || (r === half && (q & 1n)) ? q + 1n : q;
  return new Ext(neg ? -qq : qq, qmin);
}

export function toDouble(a) {
  if (!(a instanceof Ext)) return a;
  return extToNumber(roundFormat(a.m, a.e, 53, -1074)); // exactly representable -> extToNumber is exact
}
export function toFloat(a) {
  if (!(a instanceof Ext)) return Math.fround(a);
  return Math.fround(extToNumber(roundFormat(a.m, a.e, 24, -149)));
}
// PC = 53 result of an operation (53 bits, extended exponent range), as stored by FST m64
const pc53 = (x) => toDouble(roundBits(x.m, x.e, 53));

function exactAdd(x, y) {
  if (x.m === 0n) return y;
  if (y.m === 0n) return x;
  const e = Math.min(x.e, y.e);
  return new Ext((x.m << BigInt(x.e - e)) + (y.m << BigInt(y.e - e)), e);
}

export function fmul(a, b) {
  if (!(a instanceof Ext) && !(b instanceof Ext)) return a * b;
  const x = toExt(a), y = toExt(b);
  return pc53(new Ext(x.m * y.m, x.e + y.e));
}
export function fadd(a, b) {
  if (!(a instanceof Ext) && !(b instanceof Ext)) return a + b;
  return pc53(exactAdd(toExt(a), toExt(b)));
}
export function fsub(a, b) {
  if (!(a instanceof Ext) && !(b instanceof Ext)) return a - b;
  const y = toExt(b);
  return pc53(exactAdd(toExt(a), new Ext(-y.m, y.e)));
}
export function fdiv(a, b) {
  if (!(a instanceof Ext) && !(b instanceof Ext)) return a / b;
  const x = toExt(a), y = toExt(b);
  if (y.m === 0n) return a instanceof Ext ? toDouble(a) / 0 : a / 0;
  if (x.m === 0n) return 0 * Math.sign(Number(y.m));
  const neg = (x.m < 0n) !== (y.m < 0n);
  const xm = x.m < 0n ? -x.m : x.m, ym = y.m < 0n ? -y.m : y.m;
  // quotient with >= 60 significant bits plus a sticky bit -> exact rounding
  const k = Math.max(0, bitLength(ym) - bitLength(xm) + 62);
  const num = xm << BigInt(k);
  const q = num / ym;
  const sticky = num - q * ym !== 0n ? 1n : 0n;
  const m = (q << 1n) | sticky;
  const r = pc53(new Ext(neg ? -m : m, x.e - y.e - k - 1));
  return r;
}
export function fchs(a) { return a instanceof Ext ? new Ext(-a.m, a.e) : -a; }

export function chp(a) {
  if (!(a instanceof Ext)) return Math.trunc(a);
  if (a.e >= 0) return extToNumberOrExt(a);
  const q = a.m / (1n << BigInt(-a.e)); // BigInt division truncates toward zero
  return extToNumberOrExt(new Ext(q, 0));
}
function extToNumberOrExt(x) {
  const neg = x.m < 0n;
  const am = neg ? -x.m : x.m;
  if (am === 0n) return neg ? -0 : 0; // UNCERTAIN: sign of a zero result (FRNDINT keeps the sign of its operand)
  if (bitLength(am) <= 53) return extToNumber(x);
  return x;
}

export function cmp(a, b) {
  const d = exactAdd(toExt(a), fchs(toExt(b)));
  return d.m > 0n ? 1 : d.m < 0n ? -1 : 0;
}

// ---------------------------------------------------------------------------------------------------
// Accurate transcendental functions (used by lib/crt.js for FPATAN/FSIN/FCOS). Fixed-point BigInt
// arithmetic with >= 190 fractional bits beyond the argument's magnitude; the result is rounded once to
// a 64-bit mantissa, i.e. the CORRECTLY ROUNDED 64-bit result.
// Real hardware is only faithful: Intel SDM Vol. 1 §8.3.10 guarantees an error below 1 ulp (Pentium and
// later), so an FPU may return either 64-bit neighbour of the exact value; FSIN/FCOS additionally reduce
// the argument with a 66-bit pi (error bound relative to that pi), and the 387/486 microcode differs. There
// is no single hardware answer for the last bit; correct rounding is the CPU-independent choice.
// Not game-observable (audit re/audit/round1/F-risky.md F1, scripts in re/audit/round1/F-risky/x87/):
// sens.mjs propagates BOTH 64-bit neighbours of the exact atan and sin/cos for all 238000 reachable
// (num, den) pairs of the atan blocks in 0x1977e and 0x11c2a (den 1..340, num 1..340 / -19..340) through
// 0x1977e, 0x11c2a and the 0x12130 chops: 0 integer outputs change (logs/sens_340.log); sens_wide.mjs
// allows +-32 ulp in cos for a > pi/4 (the 66-bit-pi reduction error): still 0 (logs/sens_wide_340.log).
// Only the last bit of the stored doubles 0x61660 / 0x5ff40 / 0x5ff48 can differ from a given CPU.
// (With plain 53-bit Math.atan/cos/sin, 89 pairs — the 4:3 ratios — DO change integer positions in
// 0x12130: logs/sens_naive_340.log. The Ext model is required.)

const GUARD = 190;
let piBits = 0, piBig = 0n;
function atanInv(n, P) { // atan(1/n) * 2^P
  const S = 1n << BigInt(P);
  const nn = BigInt(n) * BigInt(n);
  let term = S / BigInt(n);
  let sum = term;
  for (let k = 1n; term !== 0n; k++) {
    term = term / nn;
    const t = term / (2n * k + 1n);
    sum += (k & 1n) ? -t : t;
  }
  return sum;
}
function pi(P) { // pi * 2^P (truncated)
  if (P > piBits) {
    piBits = Math.max(P, 1024);
    const Q = piBits + 32;
    piBig = (16n * atanInv(5, Q) - 4n * atanInv(239, Q)) >> 32n;
  }
  return piBig >> BigInt(piBits - P);
}
function isqrt(n) {
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(bitLength(n) / 2));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}
// x (Ext) as fixed point with P fractional bits (truncated)
function toFixed(x, P) {
  const s = x.e + P;
  return s >= 0 ? x.m << BigInt(s) : x.m / (1n << BigInt(-s));
}
function precFor(x) { // fractional bits so that relative precision >= GUARD bits
  if (x.m === 0n) return GUARD;
  const mag = bitLength(x.m < 0n ? -x.m : x.m) + x.e; // x ~ 2^mag
  return GUARD + Math.max(0, -mag);
}

// sin and cos of t (|t| <= ~0.8) as fixed point, P fractional bits
function sinCosSeries(t, P) {
  const S = 1n << BigInt(P);
  const t2 = (t * t) >> BigInt(P);
  // sin
  let term = t, s = t;
  for (let k = 1n; term !== 0n; k++) {
    term = -((term * t2) >> BigInt(P)) / ((2n * k) * (2n * k + 1n));
    s += term;
  }
  term = S; let c = S;
  for (let k = 1n; term !== 0n; k++) {
    term = -((term * t2) >> BigInt(P)) / ((2n * k - 1n) * (2n * k));
    c += term;
  }
  return [s, c];
}

// the reduction the CRT does for |x| >= 2^63 (0x236e0): FPREM by the 80-bit 2*pi at 0x310ec (exact)
const TWO_PI_80 = new Ext(0xc90fdaa22168c235n, 2 - 63); // bytes 35 c2 68 21 a2 da 0f c9 01 40 at 0x310ec
function fpremTwoPi(x) {
  // FPREM: x - q*C with q = trunc(x / C); exact
  const C = TWO_PI_80;
  const e = Math.min(x.e, C.e);
  const xm = x.m << BigInt(x.e - e), cm = C.m << BigInt(C.e - e);
  return new Ext(xm % cm, e); // BigInt % truncates: sign of x, like FPREM
}

function sinCosExt(x, which) {
  if (x.m === 0n) return which === 'sin' ? new Ext(0n, 0) : new Ext(1n, 0);
  const ax = x.m < 0n ? -x.m : x.m;
  if (bitLength(ax) + x.e > 63) x = fpremTwoPi(x); // C2 set for |x| >= 2^63
  const P = precFor(x) + Math.max(0, bitLength(x.m < 0n ? -x.m : x.m) + x.e) + 8;
  const X = toFixed(x, P);
  const halfPi = pi(P) >> 1n;
  // quadrant: k = round(X / (pi/2))
  let k = X >= 0n ? (X + (halfPi >> 1n)) / halfPi : -((-X + (halfPi >> 1n)) / halfPi);
  const t = X - k * halfPi;
  const [s, c] = sinCosSeries(t, P);
  const q = Number(((k % 4n) + 4n) % 4n);
  let r;
  if (which === 'sin') r = [s, c, -s, -c][q];
  else r = [c, -s, -c, s][q];
  return roundBits(r, -P, 64);
}
export const sin64 = (x) => sinCosExt(toExt(x), 'sin');
export const cos64 = (x) => sinCosExt(toExt(x), 'cos');

function atanFixed(X, P) { // |X| <= 2^P (i.e. |x| <= 1)
  const S = 1n << BigInt(P);
  let t = X;
  // three halvings: t -> t / (1 + sqrt(1 + t^2))
  for (let i = 0; i < 3; i++) {
    const r = isqrt(S * S + t * t); // sqrt(1+t^2) * 2^P
    t = (t << BigInt(P)) / (S + r);
  }
  const t2 = (t * t) >> BigInt(P);
  let term = t, sum = t;
  for (let k = 1n; term !== 0n; k++) {
    term = -((term * t2) >> BigInt(P));
    sum += term / (2n * k + 1n);
  }
  return sum * 8n;
}
export function atan64(x) {
  x = toExt(x);
  if (x.m === 0n) return new Ext(0n, 0);
  const neg = x.m < 0n;
  const a = new Ext(neg ? -x.m : x.m, x.e);
  const mag = bitLength(a.m) + a.e;
  let r, P;
  if (cmp(a, 1) <= 0) { // |x| <= 1
    P = precFor(a) + 8;
    r = atanFixed(toFixed(a, P), P);
  } else {
    // atan(x) = pi/2 - atan(1/x); 1/x with enough bits
    P = GUARD + 8;
    const Q = P + mag + 8;
    const inv = (1n << BigInt(Q + P)) / toFixed(a, Q); // (1/x) * 2^P
    r = (pi(P) >> 1n) - atanFixed(inv, P);
  }
  return roundBits(neg ? -r : r, -P, 64);
}
