const { BASE, BRAND, ACCENT } = require('../../utils/constants/colors');
const { normalizeGraph } = require('../../utils/graph');

Component({
  properties: {
    graph: Object,
    sequence: String,
    highlightedIndices: Array,
    selectedIndex: Number,
  },
  data: {
    showBackbone: true,
    showPairs: true,
    selectedNode: null,
  },
  lifetimes: {
    ready() {
      this.transform = { scale: 1, x: 0, y: 0 };
      this.draw();
    },
    detached() {
      if (this.drawTimer) clearTimeout(this.drawTimer);
    },
  },
  observers: {
    'graph,highlightedIndices,selectedIndex': function redraw() { this.draw(); },
  },
  methods: {
    prepare(width, height) {
      const graph = normalizeGraph(this.properties.graph, this.properties.sequence);
      const coordinates = new Map(((graph.layout && graph.layout.coordinates) || []).map((item) => [item.index, item]));
      const radius = Math.min(width, height) * 0.4;
      const centerX = width / 2;
      const centerY = height / 2;
      const nodeCount = graph.nodes.length;
      const layoutSize = Math.min(width, height);

      this.points = graph.nodes.map((node, fallbackIndex) => {
        const index = typeof node.index === 'number' ? node.index : ((node.data && node.data.index) || fallbackIndex);
        const coordinate = coordinates.get(index);
        const angle = -Math.PI / 2 + Math.PI * 2 * fallbackIndex / Math.max(nodeCount, 1);
        return {
          index,
          node,
          x: coordinate ? centerX + (coordinate.x - 0.5) * layoutSize : centerX + Math.cos(angle) * radius,
          y: coordinate ? centerY + (coordinate.y - 0.5) * layoutSize : centerY + Math.sin(angle) * radius,
        };
      });
      this.pointByIndex = new Map(this.points.map((point) => [point.index, point]));
      this.normalizedGraph = graph;
    },
    draw() {
      wx.nextTick(() => {
        this.createSelectorQuery().select('#rnaCanvas').fields({ node: true, size: true }).exec((result) => {
          if (!result || !result[0] || !result[0].node) return;
          const canvas = result[0].node;
          const context = canvas.getContext('2d');
          const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          const dpr = windowInfo.pixelRatio || 1;
          const width = result[0].width;
          const height = result[0].height;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          context.scale(dpr, dpr);
          context.clearRect(0, 0, width, height);
          this.prepare(width, height);

          const transform = this.transform || { scale: 1, x: 0, y: 0 };
          const nodeCount = this.points.length;
          context.save();
          context.translate(transform.x, transform.y);
          context.scale(transform.scale, transform.scale);

          (this.normalizedGraph.edges || []).forEach((edge) => {
            if (edge.type === 'backbone' && !this.data.showBackbone) return;
            if (edge.type === 'base_pair' && !this.data.showPairs) return;
            const source = this.pointByIndex.get(edge.sourceIndex);
            const target = this.pointByIndex.get(edge.targetIndex);
            if (!source || !target) return;
            context.beginPath();
            context.moveTo(source.x, source.y);
            context.lineTo(target.x, target.y);
            context.strokeStyle = edge.type === 'backbone' ? '#D6DAE4' : ACCENT;
            context.globalAlpha = edge.type === 'backbone' ? 0.65 : 0.55;
            context.lineWidth = edge.type === 'backbone' ? 1 : 1.5;
            context.stroke();
          });
          context.globalAlpha = 1;

          const highlights = new Set(this.properties.highlightedIndices || []);
          const showLabels = transform.scale > 1.25 && nodeCount < 500;
          this.points.forEach((point) => {
            const base = point.node.base || (point.node.data && point.node.data.type) || 'N';
            const selected = point.index === this.properties.selectedIndex;
            const highlighted = highlights.has(point.index);
            const radiusValue = selected ? 7 : (highlighted ? 6 : (nodeCount > 300 ? 2.2 : 4));
            if (highlighted) {
              context.beginPath();
              context.arc(point.x, point.y, radiusValue + 4, 0, Math.PI * 2);
              context.fillStyle = 'rgba(82,103,216,.18)';
              context.fill();
            }
            context.beginPath();
            context.arc(point.x, point.y, radiusValue, 0, Math.PI * 2);
            context.fillStyle = BASE[base] || BASE.N;
            context.fill();
            if (selected) {
              context.strokeStyle = BRAND;
              context.lineWidth = 3;
              context.stroke();
            }
            if (showLabels) {
              context.fillStyle = '#172033';
              context.font = '8px sans-serif';
              context.fillText(base, point.x - 2.5, point.y - 8);
            }
          });
          context.restore();
        });
      });
    },
    scheduleDraw() {
      if (this.drawPending) return;
      this.drawPending = true;
      this.drawTimer = setTimeout(() => {
        this.drawPending = false;
        this.draw();
      }, 32);
    },
    toggleBackbone() { this.setData({ showBackbone: !this.data.showBackbone }, () => this.draw()); },
    togglePairs() { this.setData({ showPairs: !this.data.showPairs }, () => this.draw()); },
    reset() {
      this.transform = { scale: 1, x: 0, y: 0 };
      this.setData({ selectedNode: null }, () => this.draw());
    },
    touchStart(event) {
      this.lastTouches = event.touches;
      this.touchStartedAt = Date.now();
    },
    touchMove(event) {
      const touches = event.touches;
      const transform = this.transform;
      if (!this.lastTouches || !touches.length) return;
      if (touches.length === 1 && this.lastTouches.length === 1) {
        transform.x += touches[0].x - this.lastTouches[0].x;
        transform.y += touches[0].y - this.lastTouches[0].y;
      } else if (touches.length >= 2 && this.lastTouches.length >= 2) {
        const distance = (items) => Math.hypot(items[0].x - items[1].x, items[0].y - items[1].y);
        transform.scale = Math.max(0.5, Math.min(5, transform.scale * distance(touches) / Math.max(1, distance(this.lastTouches))));
      }
      this.lastTouches = touches;
      this.scheduleDraw();
    },
    touchEnd(event) {
      const now = Date.now();
      const isTap = now - this.touchStartedAt < 250 && this.lastTouches && this.lastTouches.length === 1;
      if (isTap && this.lastTapAt && now - this.lastTapAt < 320) {
        this.lastTapAt = 0;
        this.reset();
        this.lastTouches = event.touches;
        return;
      }
      if (isTap && this.points) {
        this.lastTapAt = now;
        const touch = this.lastTouches[0];
        const transform = this.transform;
        const x = (touch.x - transform.x) / transform.scale;
        const y = (touch.y - transform.y) / transform.scale;
        let selected = null;
        let nearestDistance = 18 / transform.scale;
        this.points.forEach((point) => {
          const nextDistance = Math.hypot(point.x - x, point.y - y);
          if (nextDistance < nearestDistance) {
            nearestDistance = nextDistance;
            selected = point;
          }
        });
        if (selected) {
          const base = selected.node.base || (selected.node.data && selected.node.data.type) || 'N';
          this.setData({ selectedNode: { index: selected.index, position: selected.index + 1, base } });
          this.triggerEvent('select', { index: selected.index });
        }
      }
      this.lastTouches = event.touches;
    },
  },
});
