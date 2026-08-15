const { MODIFICATION_BY_NAME } = require('../../utils/constants/modifications');
const { BASE } = require('../../utils/constants/colors');
Component({
  properties: { sequence: String, weights: Array, modificationNames: Array },
  data: { selectedName: '', selectedPickerIndex: 0, topX: 5, siteIndex: 0, sites: [], viewport: [] },
  observers: { 'sequence,weights,modificationNames': function() { this.rebuild(); } },
  methods: {
    rebuild() {
      const names = this.properties.modificationNames && this.properties.modificationNames.length ? this.properties.modificationNames : [];
      const selectedName = names.includes(this.data.selectedName) ? this.data.selectedName : (names[0] || '');
      const meta = MODIFICATION_BY_NAME[selectedName];
      const sites = (this.properties.weights || []).filter((item) => !meta || item.type === meta.base || (meta.base === 'U' && item.type === 'T')).sort((a,b)=>b.score-a.score).slice(0, this.data.topX);
      const siteIndex = Math.min(this.data.siteIndex, Math.max(0, sites.length - 1));
      this.setData({ selectedName, selectedPickerIndex: Math.max(0, names.indexOf(selectedName)), sites, siteIndex }, () => this.updateViewport());
    },
    updateViewport() {
      const site = this.data.sites[this.data.siteIndex]; const sequence = this.properties.sequence || '';
      if (!site) return this.setData({ viewport: [] });
      const start = Math.max(0, site.index - 12); const end = Math.min(sequence.length, site.index + 13);
      this.setData({ viewport: sequence.slice(start,end).split('').map((base, i) => ({ base, index: start+i, position: start+i+1, color: BASE[base] || BASE.N, active: start+i === site.index })) });
      this.triggerEvent('selectsite', { index: site.index, score: site.score });
    },
    onModification(e) { this.setData({ selectedPickerIndex: Number(e.detail.value), selectedName: this.properties.modificationNames[Number(e.detail.value)], siteIndex: 0 }, () => this.rebuild()); },
    onTopX(e) { const topX = Math.max(1, Math.min(20, Number(e.detail.value) || 5)); this.setData({ topX, siteIndex: 0 }, () => this.rebuild()); },
    prev() { if (this.data.siteIndex > 0) this.setData({ siteIndex: this.data.siteIndex - 1 }, () => this.updateViewport()); },
    next() { if (this.data.siteIndex < this.data.sites.length - 1) this.setData({ siteIndex: this.data.siteIndex + 1 }, () => this.updateViewport()); }
  }
});
