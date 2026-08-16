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

test('classification immediately renders all categories with Not detected wording', () => {
  const js = source('components/classification-tree/index.js');
  const wxml = source('components/classification-tree/index.wxml');
  assert.match(js, /prepareGroups\(classification\)/);
  assert.doesNotMatch(js, /showAll|displayGroups|toggleAll/);
  assert.match(wxml, /12 total/);
  assert.match(wxml, /Not detected/);
  assert.doesNotMatch(wxml, /未检测|未检出|查看全部|仅查看|View all|Detected only/);
});

test('attention sites use one horizontal sequence with positions, Top highlighting and key-site navigation', () => {
  const js = source('components/attention-sites/index.js');
  const wxml = source('components/attention-sites/index.wxml');
  const wxss = source('components/attention-sites/index.wxss');
  assert.match(js, /keyRanks\[index\] \|\| 0/);
  assert.match(js, /activeAnchor: selectedSite \? `sequence-position-\$\{selectedSite\.index\}`/);
  assert.match(wxml, /<scroll-view[\s\S]*scroll-x[\s\S]*scroll-into-view="\{\{activeAnchor\}\}"/);
  assert.match(wxml, /class="position-label">\{\{item\.position\}\}<\/text>/);
  assert.match(wxml, /item\.keyRank \? 'key' : 'muted'/);
  assert.match(wxml, /← Previous/);
  assert.match(wxml, /Next →/);
  assert.match(wxss, /\.sequence-row\{[^}]*display:inline-flex/);
  assert.match(wxss, /\.sequence-position\.muted \.base-box\{/);
  assert.match(wxss, /\.sequence-position\.key \.base-box\{/);
});
