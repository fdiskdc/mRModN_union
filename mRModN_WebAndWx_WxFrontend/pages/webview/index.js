const { isTrustedWebUrl, buildWebUrl } = require('../../utils/config/api');
Page({
  data:{url:''},
  onLoad(options){
    const jobId=options.jobId&&decodeURIComponent(options.jobId);let url=options.url&&decodeURIComponent(options.url);
    if(!url&&jobId)url=buildWebUrl(`/embed/results/${encodeURIComponent(jobId)}?tab=gcn`);
    if(!url||!jobId||!isTrustedWebUrl(url)||url.indexOf(`/embed/results/${encodeURIComponent(jobId)}`)<0){wx.showModal({title:'无法打开',content:'链接不受信任或任务 ID 无效。',showCancel:false,success:()=>wx.navigateBack()});return;}
    this.setData({url});
  },
  onMessage(e){const messages=(e.detail&&e.detail.data)||[];console.log('mRModN WebView message',messages);}
});
