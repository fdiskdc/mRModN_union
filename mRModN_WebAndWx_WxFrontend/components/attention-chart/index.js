const { BRAND } = require('../../utils/constants/colors');
Component({
  properties: { classData: Object, sequenceLength: Number, modeledStart: Number, selectedPosition: Number },
  data: { canvasWidth: 0, canvasHeight: 0 },
  lifetimes: { ready() { this.draw(); } },
  observers: { 'classData,selectedPosition': function() { this.draw(); } },
  methods: {
    draw() {
      const weights = this.properties.classData && this.properties.classData.attention;
      if (!weights || !weights.length) return;
      wx.nextTick(() => {
        this.createSelectorQuery().select('#attentionCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res || !res[0] || !res[0].node) return;
          const canvas=res[0].node, ctx=canvas.getContext('2d'), dpr=wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio;
          const width=res[0].width, height=res[0].height; canvas.width=width*dpr; canvas.height=height*dpr; ctx.scale(dpr,dpr); ctx.clearRect(0,0,width,height);
          const pad={l:38,r:12,t:18,b:28}, cw=width-pad.l-pad.r, ch=height-pad.t-pad.b; const max=Math.max(...weights,1e-9);
          ctx.strokeStyle='#E8EBF2';ctx.lineWidth=1;for(let i=0;i<4;i++){const y=pad.t+ch*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();}
          const points=weights.map((v,i)=>({x:pad.l+(weights.length===1?0:i/(weights.length-1))*cw,y:pad.t+ch-(v/max)*ch}));
          ctx.beginPath();ctx.moveTo(points[0].x,pad.t+ch);points.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(points[points.length-1].x,pad.t+ch);ctx.closePath();const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);grad.addColorStop(0,'rgba(82,103,216,.32)');grad.addColorStop(1,'rgba(82,103,216,.02)');ctx.fillStyle=grad;ctx.fill();
          ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=BRAND;ctx.lineWidth=2;ctx.stroke();
          const start=Number(this.properties.modeledStart||0),selected=this.properties.selectedPosition-start;if(Number.isInteger(selected)&&selected>=0&&selected<points.length){const p=points[selected];ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle='#28A69A';ctx.fill();}
          ctx.fillStyle='#6C7588';ctx.font='10px sans-serif';ctx.fillText(String(start+1),pad.l,pad.t+ch+18);ctx.fillText(String(start+weights.length),width-pad.r-32,pad.t+ch+18);
        });
      });
    },
    onTap(e) {
      const weights=this.properties.classData && this.properties.classData.attention;if(!weights||!weights.length)return;
      this.createSelectorQuery().select('#attentionCanvas').boundingClientRect((rect)=>{const x=e.detail.x-38;const idx=Math.max(0,Math.min(weights.length-1,Math.round(x/(rect.width-50)*(weights.length-1))));this.triggerEvent('select',{index:Number(this.properties.modeledStart||0)+idx,value:weights[idx]});}).exec();
    }
  }
});
