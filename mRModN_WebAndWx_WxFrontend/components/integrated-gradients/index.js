function nucleotideName(base) {
  return ({ A: 'adenine', C: 'cytosine', G: 'guanine', U: 'uracil', T: 'thymine' })[base] || 'unknown base';
}

Component({
  properties: {
    sequence: { type: String, value: '' },
    result: { type: Object, value: null },
    topK: { type: Number, value: 5 },
  },
  data: {
    windowStart: 0,
    windowSize: 10,
    sites: [],
    visibleSites: [],
    topSites: [],
    highlightedIndices: [],
    selectedSite: null,
    canPrev: false,
    canNext: false,
    windowEnd: 0,
  },
  observers: {
    'sequence,result,topK': function rebuild() { this.rebuild(); },
  },
  methods: {
    rebuild() {
      const sequence = String(this.properties.sequence || '').toUpperCase();
      const result = this.properties.result || {};
      const scoreByIndex = {};
      (result.nodes || []).forEach((node) => {
        const data = node.data || {};
        const index = Number(data.index);
        if (Number.isInteger(index)) scoreByIndex[index] = Number(data.attributionScore || 0);
      });
      const ranked = sequence.split('').map((base, index) => ({
        index,
        position: index + 1,
        base,
        name: nucleotideName(base),
        score: scoreByIndex[index] || 0,
      })).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
      const topK = Math.max(1, Math.min(Number(this.properties.topK) || 5, ranked.length || 1));
      const topIndices = new Set(ranked.slice(0, topK).map((site) => site.index));
      const sites = sequence.split('').map((base, index) => {
        const score = scoreByIndex[index] || 0;
        return {
          index,
          position: index + 1,
          base,
          name: nucleotideName(base),
          score,
          scoreText: `${score >= 0 ? '+' : ''}${score.toFixed(5)}`,
          isTop: topIndices.has(index),
          tone: topIndices.has(index) ? (score >= 0 ? 'positive' : 'negative') : 'muted',
        };
      });
      const maxStart = Math.max(0, sites.length - this.data.windowSize);
      const windowStart = Math.min(this.data.windowStart, maxStart);
      this.setData({
        sites,
        topSites: ranked.slice(0, topK).map((site, rank) => ({
          ...site,
          rank: rank + 1,
          scoreText: `${site.score >= 0 ? '+' : ''}${site.score.toFixed(6)}`,
          tone: site.score >= 0 ? 'positive' : 'negative',
        })),
        highlightedIndices: Array.from(topIndices),
        windowStart,
      }, () => this.refreshWindow());
    },
    refreshWindow() {
      const start = this.data.windowStart;
      const size = this.data.windowSize;
      this.setData({
        visibleSites: this.data.sites.slice(start, start + size),
        canPrev: start > 0,
        canNext: start + size < this.data.sites.length,
        windowEnd: Math.min(start + size, this.data.sites.length),
      });
    },
    previous() {
      if (!this.data.canPrev) return;
      this.setData({ windowStart: Math.max(0, this.data.windowStart - this.data.windowSize) }, () => this.refreshWindow());
    },
    next() {
      if (!this.data.canNext) return;
      const maxStart = Math.max(0, this.data.sites.length - this.data.windowSize);
      this.setData({ windowStart: Math.min(maxStart, this.data.windowStart + this.data.windowSize) }, () => this.refreshWindow());
    },
    selectSite(event) {
      const index = Number(event.detail && event.detail.index !== undefined ? event.detail.index : event.currentTarget.dataset.index);
      const selectedSite = this.data.sites.find((site) => site.index === index) || null;
      this.setData({ selectedSite });
      this.triggerEvent('select', { index });
    },
  },
});
