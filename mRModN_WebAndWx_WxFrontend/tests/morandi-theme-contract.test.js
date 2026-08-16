const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function collectThemeSources(directory = root) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === 'miniprogram_npm' || entry.name === 'tests') return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectThemeSources(fullPath);
    return /\.(wxss|wxml|js)$/.test(entry.name) || entry.name === 'app.json'
      ? [fs.readFileSync(fullPath, 'utf8')]
      : [];
  }).join('\n');
}

test('the mini-program uses the shared Morandi palette instead of the legacy saturated blue', () => {
  const palette = source('utils/constants/colors.js');
  const app = source('app.json');
  const allSources = collectThemeSources();

  assert.match(palette, /BRAND: '#718394'/);
  assert.match(palette, /ACCENT: '#728B7B'/);
  assert.match(palette, /HIGHLIGHT: '#B27C6C'/);
  assert.match(app, /"navigationBarBackgroundColor": "#718394"/);
  assert.doesNotMatch(allSources, /#5267D8|rgba\(82,\s*103,\s*216/i);
});

test('data visualization keeps distinct muted semantic colors', () => {
  const attention = source('components/attention-sites/index.wxss');
  const gradients = source('components/integrated-gradients/index.wxss');
  const gcn = source('components/gcn-message-passing/index.wxss');
  const graph = source('components/rna-graph/index.wxss');

  assert.match(attention, /\.sequence-position\.key \.base-box\{[^}]*#B27C6C/);
  assert.match(attention, /\.sequence-position\.muted \.base-box\{[^}]*#E2E1DC/);
  assert.match(gradients, /\.dot\.positive\{background:#B27C6C\}/);
  assert.match(gradients, /\.dot\.negative\{background:#70859B\}/);
  assert.match(gcn, /\.dot\.message\{background:#728B7B\}/);
  assert.match(graph, /\.canvas\{[^}]*background:#E9EBE8/);
});
