Component({
  properties: {
    sequence: { type: String, value: '' },
    result: { type: Object, value: null },
  },
  data: {
    layerIndex: 0,
    layers: [],
    layerLabels: [],
    sites: [],
    visibleSites: [],
    messages: [],
    highlightedIndices: [],
    windowStart: 0,
    windowSize: 10,
    canPrev: false,
    canNext: false,
    selectedIndex: -1,
    windowEnd: 0,
  },
  observers: {
    'sequence,result': function rebuild() { this.rebuild(); },
  },
  methods: {
    rebuild() {
      const result = this.properties.result || {};
      const layers = result.aggregationData || [];
      const selectedIndex = Number.isInteger(Number(result.targetNode)) ? Number(result.targetNode) : -1;
      const centered = Math.max(0, selectedIndex - Math.floor(this.data.windowSize / 2));
      this.setData({
        layers,
        layerLabels: layers.map((item, index) => `第 ${Number(item.layer) + 1 || index + 1} 层`),
        layerIndex: Math.min(this.data.layerIndex, Math.max(0, layers.length - 1)),
        selectedIndex,
        windowStart: centered,
      }, () => this.buildLayer());
    },
    buildLayer() {
      const sequence = String(this.properties.sequence || '').toUpperCase();
      const result = this.properties.result || {};
      const layer = this.data.layers[this.data.layerIndex] || { messages: [] };
      const rawMessages = (layer.messages || []).map((message) => ({
        index: Number(message.from),
        strength: Number(message.strength || 0),
      })).filter((message) => Number.isInteger(message.index) && message.index >= 0 && message.index < sequence.length);
      const maxStrength = Math.max(...rawMessages.map((item) => Math.abs(item.strength)), 0.000001);
      const messageMap = {};
      rawMessages.forEach((message) => { messageMap[message.index] = message; });
      const target = Number(result.targetNode);
      const sites = sequence.split('').map((base, index) => {
        const message = messageMap[index];
        const ratio = message ? Math.abs(message.strength) / maxStrength : 0;
        return {
          index,
          position: index + 1,
          base,
          strength: message ? message.strength : 0,
          strengthText: message ? Number(message.strength).toFixed(5) : '—',
          opacity: (0.22 + ratio * 0.78).toFixed(2),
          role: index === target ? 'target' : (message ? 'message' : 'muted'),
        };
      });
      const messages = rawMessages.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength)).map((message, rank) => ({
        ...message,
        rank: rank + 1,
        position: message.index + 1,
        base: sequence[message.index],
        strengthText: message.strength.toFixed(6),
      }));
      const maxStart = Math.max(0, sites.length - this.data.windowSize);
      this.setData({
        sites,
        messages,
        highlightedIndices: messages.map((item) => item.index),
        windowStart: Math.min(this.data.windowStart, maxStart),
      }, () => this.refreshWindow());
    },
    onLayerChange(event) { this.setData({ layerIndex: Number(event.detail.value), windowStart: 0 }, () => this.buildLayer()); },
    refreshWindow() {
      const start = this.data.windowStart;
      const size = this.data.windowSize;
      this.setData({ visibleSites: this.data.sites.slice(start, start + size), canPrev: start > 0, canNext: start + size < this.data.sites.length, windowEnd: Math.min(start + size, this.data.sites.length) });
    },
    previous() { if(this.data.canPrev)this.setData({windowStart:Math.max(0,this.data.windowStart-this.data.windowSize)},()=>this.refreshWindow()); },
    next() { if(this.data.canNext)this.setData({windowStart:Math.min(Math.max(0,this.data.sites.length-this.data.windowSize),this.data.windowStart+this.data.windowSize)},()=>this.refreshWindow()); },
    onGraphSelect(event) { this.triggerEvent('select', { index: event.detail.index }); },
  },
});
