// Production build: bundle the ES modules into one file with esbuild and assemble a deployable dist/.
//   dist/index.html   the page, loading boot.js instead of src/boot.js
//   dist/boot.js      all of src/ in one minified ES module (+ boot.js.map)
//   dist/favicon.ico, dist/assets/   copied as they are
// Development does not need this: `npm start` serves the source modules directly.
// Usage: npm run build   (then `npm run preview` serves dist/ on port 8643)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const dist = root + 'dist/';
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

const result = await build({
  entryPoints: [root + 'src/boot.js'],
  outfile: dist + 'boot.js',
  bundle: true,
  format: 'esm',          // boot.js uses top-level await
  target: 'es2022',
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
});

const html = readFileSync(root + 'index.html', 'utf8');
const script = '<script type="module" src="src/boot.js"></script>';
if (!html.includes(script)) throw new Error('index.html: boot script tag not found');
writeFileSync(dist + 'index.html', html.replace(script, '<script type="module" src="boot.js"></script>'));
cpSync(root + 'favicon.ico', dist + 'favicon.ico');
cpSync(root + 'assets', dist + 'assets', { recursive: true });

const out = result.metafile.outputs[dist.replace(root, '') + 'boot.js'];
const inputs = Object.keys(result.metafile.inputs).length;
console.log(`dist/boot.js: ${inputs} modules -> ${(out.bytes / 1024).toFixed(1)} KB`);
