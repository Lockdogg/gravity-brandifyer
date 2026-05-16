import * as esbuild from 'esbuild';
import fs from 'node:fs';
import postcss from 'postcss';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const tailwindcss = _require('tailwindcss');
const autoprefixer = _require('autoprefixer');
const tailwindConfig = _require('./tailwind.config.js');

const watch = process.argv.includes('--watch');

const baseOptions = {
  bundle: true,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  loader: { '.svg': 'text' },
};

async function buildMain() {
  const ctx = await esbuild.context({
    ...baseOptions,
    entryPoints: ['src/main/index.ts'],
    outfile: 'build/main.js',
    platform: 'browser',
    target: 'es2017',
    format: 'iife',
  });
  if (watch) await ctx.watch();
  else { await ctx.rebuild(); await ctx.dispose(); }
}

async function buildUi() {
  const ctx = await esbuild.context({
    ...baseOptions,
    entryPoints: ['src/ui/ui.tsx'],
    outfile: 'build/ui.js',
    platform: 'browser',
    target: 'es2022',
    format: 'iife',
    jsx: 'automatic',
  });
  if (watch) await ctx.watch();
  else { await ctx.rebuild(); await ctx.dispose(); }
}

async function buildCss() {
  const input = fs.readFileSync('src/ui/styles.css', 'utf8');
  const result = await postcss([tailwindcss(tailwindConfig), autoprefixer]).process(input, {
    from: 'src/ui/styles.css',
    to: 'build/ui.css',
  });
  fs.writeFileSync('build/ui.css', result.css);
}

function bundleHtml() {
  const html = fs.readFileSync('src/ui/index.html', 'utf8');
  const js = fs.readFileSync('build/ui.js', 'utf8');
  const css = fs.readFileSync('build/ui.css', 'utf8');
  const withCss = html.replace('</head>', () => `<style>${css}</style></head>`);
  const bundled = withCss.replace('<script src="ui.js"></script>', () => `<script>${js}</script>`);
  fs.writeFileSync('build/ui.html', bundled);
}

if (watch) {
  await Promise.all([buildMain(), buildUi(), buildCss()]);
  console.log('[watch] Build started, watching for changes...');
} else {
  await Promise.all([buildMain(), buildUi(), buildCss()]);
  bundleHtml();
  console.log('[build] Done.');
}
