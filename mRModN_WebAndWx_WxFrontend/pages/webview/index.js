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
      this.failAndBack('A task ID is required to load the RNA structure.');
      return;
    }
    this.setData({ jobId });
    this.load3dPage();
  },
  load3dPage() {
    const url = buildEmbedResultsUrl(this.data.jobId, 'gcn');
    if (!isTrustedWebUrl(url)) {
      this.failAndBack('The RNA structure URL is not trusted. Check the current LAN/production environment configuration.');
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
      title: 'Unable to Open RNA Structure',
      content,
      showCancel: false,
      success: () => wx.navigateBack(),
    });
  },
  onWebViewLoad() {
    this.setData({ loading: false, error: '' });
  },
  onWebViewError(e) {
    const message = (e.detail && e.detail.errMsg) || 'Failed to load the WebView page';
    this.setData({ loading: false, error: message });
    console.error('mRModN 3D WebView load failed:', message);
  },
  onMessage(e) {
    const messages = (e.detail && e.detail.data) || [];
    console.log('mRModN WebView message', messages);
  },
});
