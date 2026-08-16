const { ENDPOINTS } = require('../../utils/config/api');
const { requestWithFallback } = require('../../utils/request');
const { MODIFICATIONS } = require('../../utils/constants/modifications');
const { normalizeGraph, topAttentionIndices } = require('../../utils/graph');

const GROUP_LABELS = {
  'Group A': 'Adenine A', 'Group C': 'Cytosine C', 'Group G': 'Guanine G', 'Group U': 'Uracil U',
  A: 'Adenine A', C: 'Cytosine C', G: 'Guanine G', U: 'Uracil U',
};
const RESULT_TABS = [
  { value: 'overview', label: 'Overview', icon: '⌂' },
  { value: 'classification', label: 'Classes', icon: '▦' },
  { value: 'attention', label: 'Attention', icon: '◉' },
  { value: 'structure', label: 'Structure', icon: '⌬' },
  { value: 'interpretability', label: 'Explain', icon: '◎' },
];
const TOP_K_OPTIONS = [5, 10, 20];

function formatClassification(value) {
  const sourceGroups = (value && value.children) || [];
  const sourceItems = {};
  sourceGroups.forEach((group) => (group.children || []).forEach((item) => { sourceItems[item.name] = item; }));
  const children = ['A', 'C', 'G', 'U'].map((base) => {
    const sourceGroup = sourceGroups.find((group) => group.name === base || group.name === `Group ${base}`) || {};
    const groupChildren = MODIFICATIONS.filter((item) => item.base === base).map((meta) => ({
      name: meta.name, probability: 0, threshold: null, isPredicted: false, ...(sourceItems[meta.name] || {}),
    }));
    return {
      ...sourceGroup,
      name: GROUP_LABELS[sourceGroup.name] || GROUP_LABELS[base],
      isPredicted: groupChildren.some((item) => item.isPredicted),
      children: groupChildren,
    };
  });
  return { ...(value || {}), name: 'RNA Modification Classification', children };
}

function predictedNames(classification) {
  const names = [];
  ((classification && classification.children) || []).forEach((group) => (group.children || []).forEach((item) => {
    if (item.isPredicted) names.push(item.name);
  }));
  return names;
}

function prepareResult(item, displayIndex) {
  const classification = formatClassification(item.classification);
  const sequence = item.sequence || (item.attention && item.attention.sequence) || (item.gcn && item.gcn.sequence) || '';
  const names = predictedNames(classification);
  const graph = normalizeGraph(item.gcn, sequence);
  const weights = ((item.attention && item.attention.weights) || []).map((value) => ({
    ...value, scoreText: Number(value.score || 0).toFixed(6),
  }));
  const classes = (classification.children || []).reduce((all, group) => all.concat(group.children || []), []);
  const topClass = classes.slice().sort((a, b) => Number(b.probability || 0) - Number(a.probability || 0))[0];
  const topModification = topClass && typeof topClass.probability === 'number'
    ? `${topClass.name} · ${(topClass.probability * 100).toFixed(1)}%`
    : (topClass && topClass.name) || 'No probability data';
  return {
    ...item,
    displayIndex,
    sequence,
    sequencePreview: sequence.length > 54 ? `${sequence.slice(0, 54)}…` : sequence,
    sequenceLength: sequence.length,
    predictedCount: names.length,
    edgeCount: graph.edges.length,
    topModification,
    classification,
    modificationNames: names,
    attentionWeights: weights,
    gcn: graph,
    highlightedIndices: topAttentionIndices(weights),
  };
}

function explanationPayload(response) {
  const body = (response && response.data) || {};
  return body.data || body;
}

Page({
  data: {
    batchJobId: '', isLoading: true, error: '', results: [], currentResultIndex: 0, currentResult: null,
    resultTabs: RESULT_TABS, currentResultTab: 'overview', attentionMode: 'sites',
    attentionDistribution: null, attentionClasses: [], attentionClassIndex: 0, selectedAttentionClass: null,
    selectedPosition: -1, loadingAttention: false, predictedOnly: true,
    interpretabilityMode: 'integrated-gradients',
    modificationOptions: MODIFICATIONS,
    igClassIndex: 0,
    topKOptions: TOP_K_OPTIONS,
    igTopKIndex: 0,
    igLoading: false,
    igError: '',
    igResult: null,
    gcnTargetPosition: 1,
    gcnLoading: false,
    gcnError: '',
    gcnResult: null,
  },

  onLoad(options) {
    this.explanationTimers = {};
    if (!options.batchJobId) { this.setData({ isLoading: false, error: 'Missing batch task ID' }); return; }
    const batchJobId = decodeURIComponent(options.batchJobId);
    this.setData({ batchJobId });
    const cached = wx.getStorageSync(`batch:${batchJobId}`);
    if (cached && cached.results && cached.results.length) this.applyResults(cached.results, false);
    this.loadBatch();
  },
  onUnload() { Object.keys(this.explanationTimers || {}).forEach((key) => clearTimeout(this.explanationTimers[key])); },
  onPullDownRefresh() { this.loadBatch().finally(() => wx.stopPullDownRefresh()); },

  loadBatch() {
    this.setData({ error: '' });
    return requestWithFallback(ENDPOINTS.WX_TASK_PROGRESS(this.data.batchJobId), { method: 'GET' }).then((res) => {
      const payload = res.data && res.data.data;
      if (!payload) throw { message: 'Invalid task response format' };
      const results = (payload.results || []).slice().sort((a, b) => a.index - b.index);
      wx.setStorageSync(`batch:${this.data.batchJobId}`, { batchJobId: this.data.batchJobId, results, status: payload.status, updatedAt: Date.now() });
      this.applyResults(results, true);
    }).catch((err) => {
      if (err.statusCode === 401) {
        wx.removeStorageSync('sessionToken');
        this.setData({ isLoading: false, error: 'Your session has expired. Return to the home page and sign in again.' });
        return;
      }
      if (!this.data.results.length) this.setData({ isLoading: false, error: err.message || 'Unable to load results' });
    });
  },
  applyResults(items, refresh) {
    const valid = items.filter((item) => item.status !== 'failed').map((item, index) => prepareResult(item, index + 1));
    if (!valid.length) {
      this.setData({ isLoading: false, error: items.length ? 'Analysis failed for all sequences' : 'The task has not produced any results yet' });
      return;
    }
    const index = Math.min(this.data.currentResultIndex, valid.length - 1);
    const currentResult = valid[index];
    const highest = (currentResult.classification.children || []).reduce((all, group) => all.concat(group.children || []), [])
      .sort((a, b) => Number(b.probability || 0) - Number(a.probability || 0))[0];
    const igClassIndex = Math.max(0, MODIFICATIONS.findIndex((item) => highest && item.name === highest.name));
    this.setData({
      results: valid, currentResultIndex: index, currentResult, isLoading: false, error: '', igClassIndex,
      gcnTargetPosition: Math.max(1, Math.ceil(currentResult.sequenceLength / 2)),
    });
    const missing = valid.filter((item) => item.jobId && (!item.classification || !item.gcn || !item.attention));
    if (refresh && missing.length) Promise.all(missing.map((item) => this.loadSingle(item.jobId, item.index))).then(() => {});
  },
  loadSingle(jobId, originalIndex) {
    return requestWithFallback(ENDPOINTS.RESULT(jobId), { method: 'GET' }).then((res) => {
      const items = this.data.results.slice();
      const position = items.findIndex((item) => item.jobId === jobId);
      if (position >= 0) {
        items[position] = prepareResult({ ...items[position], ...res.data, index: originalIndex }, position + 1);
        this.setData({ results: items, currentResult: position === this.data.currentResultIndex ? items[position] : this.data.currentResult });
      }
    }).catch(() => {});
  },
  onSequenceTab(event) {
    const index = Number(event.currentTarget.dataset.index);
    const currentResult = this.data.results[index];
    this.cancelExplanationPolls();
    this.setData({
      currentResultIndex: index, currentResult,
      attentionDistribution: null, attentionClasses: [], attentionClassIndex: 0, selectedAttentionClass: null,
      selectedPosition: -1, igResult: null, igError: '', gcnResult: null, gcnError: '',
      gcnTargetPosition: Math.max(1, Math.ceil(currentResult.sequenceLength / 2)),
    });
    if (this.data.currentResultTab === 'attention' && this.data.attentionMode === 'distribution') this.loadAttentionDistribution();
  },
  cancelExplanationPolls() {
    Object.keys(this.explanationTimers || {}).forEach((key) => clearTimeout(this.explanationTimers[key]));
    this.explanationTimers = {};
  },
  switchResultTab(tab) {
    if (!tab) return;
    this.setData({ currentResultTab: tab });
    if (tab === 'attention' && this.data.attentionMode === 'distribution') this.loadAttentionDistribution();
  },
  onResultTab(event) { this.switchResultTab(event.detail.value); },
  onResultTabTap(event) { this.switchResultTab(event.currentTarget.dataset.value); },
  onSummaryOpen(event) { this.switchResultTab(event.detail.tab); },
  setAttentionMode(event) {
    const mode = event.currentTarget.dataset.mode;
    this.setData({ attentionMode: mode });
    if (mode === 'distribution') this.loadAttentionDistribution();
  },
  loadAttentionDistribution(force) {
    const result = this.data.currentResult;
    if (!result || !result.jobId || this.data.loadingAttention || (this.data.attentionDistribution && !force)) return;
    this.setData({ loadingAttention: true });
    requestWithFallback(ENDPOINTS.ATTENTION_DISTRIBUTION(result.jobId, this.data.predictedOnly), { method: 'GET' }).then((res) => {
      const data = res.data || {};
      const classes = (data.classes || []).map((item) => ({ ...item, probabilityText: `${(Number(item.probability || 0) * 100).toFixed(2)}%` }));
      this.setData({ attentionDistribution: data, attentionClasses: classes, attentionClassIndex: 0, selectedAttentionClass: classes[0] || null, loadingAttention: false });
    }).catch((err) => this.setData({ loadingAttention: false, attentionDistribution: { error: err.message }, attentionClasses: [], selectedAttentionClass: null }));
  },
  onAttentionClass(event) { const index = Number(event.detail.value); this.setData({ attentionClassIndex: index, selectedAttentionClass: this.data.attentionClasses[index] }); },
  toggleAllClasses(event) { this.setData({ predictedOnly: !event.detail.value, attentionDistribution: null }, () => this.loadAttentionDistribution(true)); },
  onAttentionSite(event) { this.setData({ selectedPosition: event.detail.index }); },
  onChartSelect(event) { this.setData({ selectedPosition: event.detail.index }); },
  onGraphSelect(event) { this.setData({ selectedPosition: event.detail.index }); },

  setInterpretabilityMode(event) { this.setData({ interpretabilityMode: event.currentTarget.dataset.mode }); },
  onIgClassChange(event) { this.setData({ igClassIndex: Number(event.detail.value), igResult: null, igError: '' }); },
  onIgTopKChange(event) { this.setData({ igTopKIndex: Number(event.detail.value) }); },
  onGcnTargetInput(event) { this.setData({ gcnTargetPosition: Number(event.detail.value) || 1, gcnResult: null, gcnError: '' }); },
  onExplanationGraphSelect(event) {
    const position = Number(event.detail.index) + 1;
    this.setData({ selectedPosition: position - 1, gcnTargetPosition: position });
  },
  runIntegratedGradients() {
    const sequence = this.data.currentResult && this.data.currentResult.sequence;
    if (!sequence || this.data.igLoading) return;
    const targetClassId = this.data.modificationOptions[this.data.igClassIndex].index;
    this.setData({ igLoading: true, igError: '', igResult: null });
    requestWithFallback(ENDPOINTS.WX_EXPLANATION_INTEGRATED_GRADIENTS, {
      method: 'POST', timeout: 60000, data: { rnaSequence: sequence, targetClassId },
    }).then((response) => this.handleExplanationSubmission('ig', explanationPayload(response)))
      .catch((error) => this.setData({ igLoading: false, igError: error.message || 'Failed to submit Integrated Gradients computation' }));
  },
  runGcnMessagePassing() {
    const result = this.data.currentResult;
    if (!result || !result.sequence || this.data.gcnLoading) return;
    const targetNodeIdx = Math.max(0, Math.min(result.sequence.length - 1, Number(this.data.gcnTargetPosition || 1) - 1));
    this.setData({ gcnLoading: true, gcnError: '', gcnResult: null, gcnTargetPosition: targetNodeIdx + 1 });
    requestWithFallback(ENDPOINTS.WX_EXPLANATION_GCN, {
      method: 'POST', timeout: 60000, data: { rnaSequence: result.sequence, targetNodeIdx },
    }).then((response) => this.handleExplanationSubmission('gcn', explanationPayload(response)))
      .catch((error) => this.setData({ gcnLoading: false, gcnError: error.message || 'Failed to submit GCN message computation' }));
  },
  handleExplanationSubmission(kind, payload) {
    if (payload.result) { this.finishExplanation(kind, payload.result); return; }
    if (!payload.jobId) { this.failExplanation(kind, payload.message || 'The server did not return an interpretation task ID'); return; }
    this.pollExplanation(kind, payload.jobId, 0);
  },
  pollExplanation(kind, jobId, attempt) {
    if (attempt > 240) { this.failExplanation(kind, 'The interpretation task timed out. Please try again later.'); return; }
    requestWithFallback(ENDPOINTS.WX_EXPLANATION_RESULT(jobId), { method: 'GET', timeout: 30000 }).then((response) => {
      const payload = explanationPayload(response);
      const status = String(payload.status || '').toUpperCase();
      if (status === 'SUCCESS' || status === 'COMPLETED') { this.finishExplanation(kind, payload.result || payload); return; }
      if (status === 'FAILURE' || status === 'FAILED') { this.failExplanation(kind, payload.error || 'Interpretation computation failed'); return; }
      this.explanationTimers[kind] = setTimeout(() => this.pollExplanation(kind, jobId, attempt + 1), 1500);
    }).catch((error) => {
      if (attempt < 3) this.explanationTimers[kind] = setTimeout(() => this.pollExplanation(kind, jobId, attempt + 1), 1800);
      else this.failExplanation(kind, error.message || 'Unable to retrieve interpretation results');
    });
  },
  finishExplanation(kind, result) {
    if (this.explanationTimers[kind]) clearTimeout(this.explanationTimers[kind]);
    if (kind === 'ig') this.setData({ igLoading: false, igError: '', igResult: result });
    else this.setData({ gcnLoading: false, gcnError: '', gcnResult: result });
  },
  failExplanation(kind, message) {
    if (this.explanationTimers[kind]) clearTimeout(this.explanationTimers[kind]);
    if (kind === 'ig') this.setData({ igLoading: false, igError: message });
    else this.setData({ gcnLoading: false, gcnError: message });
  },

  openWebView() {
    const result = this.data.currentResult;
    if (!result || !result.jobId) return;
    wx.navigateTo({ url: `/pages/webview/index?jobId=${encodeURIComponent(result.jobId)}` });
  },
  retry() { this.setData({ isLoading: true, error: '' }); this.loadBatch(); },
  backHome() { wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/index/index' }) }); },
});
