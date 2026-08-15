const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('result primary navigation is fixed at the bottom and no top result-tabs remains', () => {
  const wxml = source('pages/results/results.wxml');
  const wxss = source('pages/results/results.wxss');
  assert.doesNotMatch(wxml, /<result-tabs\b/);
  assert.match(wxml, /class="result-bottom-nav safe-bottom"/);
  assert.match(wxss, /\.result-bottom-nav\{[^}]*position:fixed[^}]*bottom:0/);
});

test('classification immediately renders all categories with 未检出 wording', () => {
  const js = source('components/classification-tree/index.js');
  const wxml = source('components/classification-tree/index.wxml');
  assert.match(js, /prepareGroups\(classification\)/);
  assert.doesNotMatch(js, /showAll|displayGroups|toggleAll/);
  assert.match(wxml, /共 12 类/);
  assert.match(wxml, /未检出/);
  assert.doesNotMatch(wxml, /未检测|查看全部|仅查看/);
});

test('attention map highlights every Top site and mutes every other position', () => {
  const js = source('components/attention-sites/index.js');
  const wxml = source('components/attention-sites/index.wxml');
  const wxss = source('components/attention-sites/index.wxss');
  assert.match(js, /keyRanks\[index\] \|\| 0/);
  assert.match(wxml, /item\.keyRank \? 'key' : 'muted'/);
  assert.match(wxml, /全部 Top 位点同时高亮/);
  assert.match(wxss, /\.sequence-position\.muted\{/);
  assert.match(wxss, /\.sequence-position\.key\{/);
});
