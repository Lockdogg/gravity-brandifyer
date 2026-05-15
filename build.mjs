import * as esbuild from 'esbuild';
import fs from 'node:fs';

const watch = process.argv.includes('--watch');

const baseOptions = {
  bundle: true,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
};

async function buildMain() {
  const ctx = await esbuild.context({
    ...baseOptions,
    entryPoints: ['src/main/index.ts'],
    outfile: 'build/main.js',
    platform: 'browser',
    target: 'es2022',
    format: 'iife',
  });
  if (watch) await ctx.watch();
  else { await ctx.rebuild(); await ctx.dispose(); }
}

async function buildUi() {
  const ctx = await esbuild.context({
    ...baseOptions,
    entryPoints: ['src/ui/ui.ts'],
    outfile: 'build/ui.js',
    platform: 'browser',
    target: 'es2022',
    format: 'iife',
  });
  if (watch) await ctx.watch();
  else { await ctx.rebuild(); await ctx.dispose(); }
}

function bundleHtml() {
  const html = fs.readFileSync('src/ui/index.html', 'utf8');
  const js = fs.readFileSync('build/ui.js', 'utf8');
  const bundled = html.replace(
    '<script src="ui.js"></script>',
    `<script>${js}</script>`
  );
  fs.writeFileSync('build/ui.html', bundled);
}

if (watch) {
  await Promise.all([buildMain(), buildUi()]);
  // In watch mode, re-bundle HTML after each UI rebuild via esbuild plugin
  console.log('[watch] Build started, watching for changes...');
} else {
  await Promise.all([buildMain(), buildUi()]);
  bundleHtml();
  console.log('[build] Done.');
}
