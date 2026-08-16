const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function collectFiles(relativeDirectory, extensions) {
  const directory = path.join(root, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectFiles(relativePath, extensions);
    return extensions.includes(path.extname(entry.name)) ? [relativePath] : [];
  });
}

test('English is the mini-program default language', () => {
  assert.match(source('app.js'), /language:\s*'en'/);
  assert.match(source('app.json'), /"navigationBarTitleText": "mRModN RNA Analysis"/);
  assert.match(source('pages/index/index.wxml'), /Start Analysis/);
  assert.match(source('pages/results/results.wxml'), /Analysis Results/);
});

test('user-facing mini-program sources do not contain hardcoded Chinese copy', () => {
  const files = [
    'app.json',
    ...collectFiles('pages', ['.wxml', '.json', '.js']),
    ...collectFiles('components', ['.wxml', '.js']),
    'utils/request.js',
    'utils/sequence.js',
    'utils/graph.js',
  ];
  const offenders = files.filter((file) => /[\u3400-\u9fff]/.test(source(file)));
  assert.deepEqual(offenders, []);
});
