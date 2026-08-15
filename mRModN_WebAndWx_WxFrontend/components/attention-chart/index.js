const { BRAND } = require('../../utils/constants/colors');

function topIndexes(weights, count = 5) {
  return weights
    .map((value, index) => ({ index, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map((item) => item.index);
}

Component({
  properties: {
    classData: Object,
    sequenceLength: Number,
    modeledStart: Number,
    selectedPosition: Number,
  },
  data: { canvasWidth: 0, canvasHeight: 0 },
  lifetimes: { ready() { this.draw(); } },
  observers: {
    'classData,selectedPosition': function redraw() {
      this.draw();
    },
  },
  methods: {
    draw() {
      const weights = this.properties.classData && this.properties.classData.attention;
      if (!weights || !weights.length) return;
      wx.nextTick(() => {
        this.createSelectorQuery().select('#attentionCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res || !res[0] || !res[0].node) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio;
          const width = res[0].width;
          const height = res[0].height;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, width, height);

          const pad = { l: 38, r: 12, t: 24, b: 28 };
          const chartWidth = width - pad.l - pad.r;
          const chartHeight = height - pad.t - pad.b;
          const max = Math.max(...weights, 1e-9);
          ctx.strokeStyle = '#E8EBF2';
          ctx.lineWidth = 1;
          for (let index = 0; index < 4; index += 1) {
            const y = pad.t + chartHeight * index / 3;
            ctx.beginPath();
            ctx.moveTo(pad.l, y);
            ctx.lineTo(width - pad.r, y);
            ctx.stroke();
          }

          const points = weights.map((value, index) => ({
            x: pad.l + (weights.length === 1 ? 0 : index / (weights.length - 1)) * chartWidth,
            y: pad.t + chartHeight - (value / max) * chartHeight,
          }));
          ctx.beginPath();
          ctx.moveTo(points[0].x, pad.t + chartHeight);
          points.forEach((point) => ctx.lineTo(point.x, point.y));
          ctx.lineTo(points[points.length - 1].x, pad.t + chartHeight);
          ctx.closePath();
          const gradient = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartHeight);
          gradient.addColorStop(0, 'rgba(151,158,172,.22)');
          gradient.addColorStop(1, 'rgba(151,158,172,.03)');
          ctx.fillStyle = gradient;
          ctx.fill();

          ctx.beginPath();
          points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
          ctx.strokeStyle = '#A6ACB8';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          const top = topIndexes(weights);
          top.forEach((index, rank) => {
            const point = points[index];
            ctx.beginPath();
            ctx.arc(point.x, point.y, rank === 0 ? 6 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = BRAND;
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(82,103,216,.2)';
            ctx.stroke();
          });

          const start = Number(this.properties.modeledStart || 0);
          const selected = this.properties.selectedPosition - start;
          if (Number.isInteger(selected) && selected >= 0 && selected < points.length) {
            const point = points[selected];
            ctx.beginPath();
            ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#172033';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
          }

          ctx.fillStyle = '#6C7588';
          ctx.font = '10px sans-serif';
          ctx.fillText(String(start + 1), pad.l, pad.t + chartHeight + 18);
          ctx.fillText(String(start + weights.length), width - pad.r - 32, pad.t + chartHeight + 18);
        });
      });
    },
    onTap(e) {
      const weights = this.properties.classData && this.properties.classData.attention;
      if (!weights || !weights.length) return;
      this.createSelectorQuery().select('#attentionCanvas').boundingClientRect((rect) => {
        const x = e.detail.x - 38;
        const index = Math.max(0, Math.min(
          weights.length - 1,
          Math.round(x / (rect.width - 50) * (weights.length - 1)),
        ));
        this.triggerEvent('select', {
          index: Number(this.properties.modeledStart || 0) + index,
          value: weights[index],
        });
      }).exec();
    },
  },
});
