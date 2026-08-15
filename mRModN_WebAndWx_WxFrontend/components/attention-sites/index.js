const { MODIFICATION_BY_NAME } = require('../../utils/constants/modifications');

Component({
  properties: {
    sequence: String,
    weights: Array,
    modificationNames: Array,
  },
  data: {
    selectedName: '',
    selectedPickerIndex: 0,
    topX: 5,
    siteIndex: 0,
    sites: [],
    sequenceMap: [],
  },
  observers: {
    'sequence,weights,modificationNames': function rebuildOnInput() {
      this.rebuild();
    },
  },
  methods: {
    rebuild() {
      const names = this.properties.modificationNames && this.properties.modificationNames.length
        ? this.properties.modificationNames
        : [];
      const selectedName = names.includes(this.data.selectedName)
        ? this.data.selectedName
        : (names[0] || '');
      const meta = MODIFICATION_BY_NAME[selectedName];
      const sites = (this.properties.weights || [])
        .filter((item) => !meta || item.type === meta.base || (meta.base === 'U' && item.type === 'T'))
        .sort((a, b) => b.score - a.score)
        .slice(0, this.data.topX)
        .map((item, index) => ({ ...item, rank: index + 1 }));
      const siteIndex = Math.min(this.data.siteIndex, Math.max(0, sites.length - 1));
      this.setData({
        selectedName,
        selectedPickerIndex: Math.max(0, names.indexOf(selectedName)),
        sites,
        siteIndex,
      }, () => this.updateSequenceMap());
    },
    updateSequenceMap() {
      const selectedSite = this.data.sites[this.data.siteIndex];
      const keyRanks = this.data.sites.reduce((map, item) => {
        map[item.index] = item.rank;
        return map;
      }, {});
      const sequenceMap = String(this.properties.sequence || '').split('').map((base, index) => ({
        base,
        index,
        position: index + 1,
        keyRank: keyRanks[index] || 0,
        active: !!selectedSite && index === selectedSite.index,
      }));
      this.setData({ sequenceMap });
      if (selectedSite) {
        this.triggerEvent('selectsite', { index: selectedSite.index, score: selectedSite.score });
      }
    },
    onModification(e) {
      const selectedPickerIndex = Number(e.detail.value);
      this.setData({
        selectedPickerIndex,
        selectedName: this.properties.modificationNames[selectedPickerIndex],
        siteIndex: 0,
      }, () => this.rebuild());
    },
    onTopX(e) {
      const topX = Math.max(1, Math.min(20, Number(e.detail.value) || 5));
      this.setData({ topX, siteIndex: 0 }, () => this.rebuild());
    },
    selectSite(siteIndex) {
      if (!Number.isInteger(siteIndex) || siteIndex < 0 || siteIndex >= this.data.sites.length) return;
      this.setData({ siteIndex }, () => this.updateSequenceMap());
    },
    onSiteTap(e) {
      this.selectSite(Number(e.currentTarget.dataset.index));
    },
    onSequencePositionTap(e) {
      const keyRank = Number(e.currentTarget.dataset.rank);
      if (keyRank > 0) this.selectSite(keyRank - 1);
    },
    prev() {
      this.selectSite(this.data.siteIndex - 1);
    },
    next() {
      this.selectSite(this.data.siteIndex + 1);
    },
  },
});
