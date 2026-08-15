const { isTrustedWebUrl, buildEmbedResultsUrl, CLIENT_BUILD_ID } = require('../../utils/config/api');

Page({
  data: {
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
    const url = buildEmbedResultsUrl(jobId, 'gcn');
    if (!isTrustedWebUrl(url)) {
      this.failAndBack('RNA 结构页面地址不受信任，请检查当前 LAN/production 环境配置。');
      return;
    }
    console.info(`[mRModN ${CLIENT_BUILD_ID}] loading interactive RNA 3D:`, url);
    this.setData({ url, loading: true, error: '' });
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
    wx.showModal({
      title: '3D 页面加载失败',
      content: `请确认内网 Web 前端 9006 端口已启动，手机可访问该地址；开发者工具调试时还需关闭合法域名校验。\n${message}`,
      showCancel: false,
    });
  },
  onMessage(e) {
    const messages = (e.detail && e.detail.data) || [];
    console.log('mRModN WebView message', messages);
  },
});
