const { isTrustedWebUrl, buildEmbedResultsUrl, CLIENT_BUILD_ID } = require('../../utils/config/api');

Page({
  data: {
    jobId: '',
    url: '',
    loading: true,
    error: '',
  },
  onLoad(options) {
    const jobId = options.jobId && decodeURIComponent(options.jobId);
    if (!jobId) {
      this.failAndBack('缺少任务 ID，无法加载 RNA 结构。');
      return;
    }
    this.setData({ jobId });
    this.load3dPage();
  },
  load3dPage() {
    const url = buildEmbedResultsUrl(this.data.jobId, 'gcn');
    if (!isTrustedWebUrl(url)) {
      this.failAndBack('RNA 结构页面地址不受信任，请检查当前 LAN/production 环境配置。');
      return;
    }
    console.info(`[mRModN ${CLIENT_BUILD_ID}] loading interactive RNA 3D:`, url);
    this.setData({ url, loading: true, error: '' });
  },
  retry() {
    this.setData({ url: '', loading: true, error: '' }, () => {
      setTimeout(() => this.load3dPage(), 80);
    });
  },
  goBack() {
    wx.navigateBack();
  },
  failAndBack(content) {
    wx.showModal({
      title: '无法打开 RNA 结构',
      content,
      showCancel: false,
      success: () => wx.navigateBack(),
    });
  },
  onWebViewLoad() {
    this.setData({ loading: false, error: '' });
  },
  onWebViewError(e) {
    const message = (e.detail && e.detail.errMsg) || 'WebView 页面加载失败';
    this.setData({ loading: false, error: message });
    console.error('mRModN 3D WebView load failed:', message);
  },
  onMessage(e) {
    const messages = (e.detail && e.detail.data) || [];
    console.log('mRModN WebView message', messages);
  },
});
