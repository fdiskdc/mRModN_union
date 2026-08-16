const ENVIRONMENTS = {
  lan: {
    // 内网联调：直接访问 Flask 的 /api/v1 路由。
    apiOrigins: [
      'http://100.74.161.109:9005'
    ],
    appBasePath: '',
    apiPrefix: '/api/v1',
    // 内网 Web 前端用于小程序 WebView 高级可视化。
    webOrigin: 'http://100.74.161.109:9006',
    webBasePath: '/rgcnformer'
  },
  production: {
    apiOrigins: [
      'https://cmb.bnu.edu.cn'
    ],
    appBasePath: '/rgcnformer',
    apiPrefix: '/api/v1',
    webOrigin: 'https://cmb.bnu.edu.cn',
    webBasePath: '/rgcnformer'
  }
};

// 手动环境开关：内网联调使用 'lan'，发布前改为 'production'。
const CURRENT_ENV = 'lan';
const config = ENVIRONMENTS[CURRENT_ENV];
const STORAGE_KEY = 'mrmodnApiServerIndex';
// 用于 WebView 缓存隔离和现场确认；每次影响嵌入页的发布都应更新。
const CLIENT_BUILD_ID = 'wx-20260815-2';

function joinUrl(...parts) {
  return parts.map((part, index) => {
    const value = String(part || '');
    if (index === 0) return value.replace(/\/$/, '');
    return value.replace(/^\/+|\/+$/g, '');
  }).filter(Boolean).join('/');
}

function getCurrentServerIndex() {
  const value = Number(wx.getStorageSync(STORAGE_KEY) || 0);
  return value >= 0 && value < config.apiOrigins.length ? value : 0;
}
function setCurrentServerIndex(index) { wx.setStorageSync(STORAGE_KEY, index); }
function switchToNextServer() {
  const next = (getCurrentServerIndex() + 1) % config.apiOrigins.length;
  setCurrentServerIndex(next);
  return next;
}
function resetServerIndex() { wx.removeStorageSync(STORAGE_KEY); }
function getApiBaseUrl(index = getCurrentServerIndex()) {
  return joinUrl(config.apiOrigins[index], config.appBasePath, config.apiPrefix);
}
function getWebBaseUrl() { return joinUrl(config.webOrigin, config.webBasePath); }
function buildApiUrl(endpoint, index = getCurrentServerIndex()) { return joinUrl(getApiBaseUrl(index), endpoint); }
function normalizeWebPath(path) {
  const value = String(path || '').trim();
  if (!value) return '';
  // 兼容历史调用方传入带 /rgcnformer/... 的情况，
  // 防止最终地址重复拼接部署前缀。
  const queryIndex = value.indexOf('?');
  const pathname = queryIndex >= 0 ? value.slice(0, queryIndex) : value;
  const query = queryIndex >= 0 ? value.slice(queryIndex) : '';
  let normalized = `/${pathname.replace(/^\/+/, '')}`;
  const knownBasePaths = [config.webBasePath, '/rgcnformer', ['/', 'mrmodn'].join('')];
  knownBasePaths.forEach((basePath) => {
    const base = `/${String(basePath || '').replace(/^\/+|\/+$/g, '')}`;
    if (base === '/') return;
    if (normalized === base) normalized = '/';
    else if (normalized.startsWith(`${base}/`)) normalized = normalized.slice(base.length);
  });
  return `${normalized}${query}`;
}
function buildWebUrl(path) { return joinUrl(getWebBaseUrl(), normalizeWebPath(path)); }
function buildEmbedResultsUrl(jobId, tab = 'gcn') {
  const query = `tab=${encodeURIComponent(tab)}&source=wx&client=${encodeURIComponent(CLIENT_BUILD_ID)}`;
  return buildWebUrl(`/embed/results/${encodeURIComponent(jobId)}?${query}`);
}
function isTrustedWebUrl(url) {
  try {
    const expected = `${config.webOrigin}${config.webBasePath}`;
    return url === expected || url.startsWith(`${expected}/`) || url.startsWith(`${expected}?`);
  } catch (e) { return false; }
}

const ENDPOINTS = {
  SAMPLE_SEQUENCE: '/sample-sequence',
  WX_LOGIN: '/wx/login',
  WX_SUBMIT_TASK: '/wx-submit-task',
  WX_TASK_PROGRESS: (batchJobId) => `/wx-task-progress/${encodeURIComponent(batchJobId)}`,
  SUBMIT_TASK: '/submit-task',
  RESULT: (jobId) => `/results/${encodeURIComponent(jobId)}`,
  GET_RESULT: (jobId) => `/results/${encodeURIComponent(jobId)}`,
  ATTENTION_DISTRIBUTION: (jobId, predictedOnly = true) => `/results/${encodeURIComponent(jobId)}/attention-distribution?predictedOnly=${predictedOnly}`,
  ATTENTION_VISUALIZATION: '/attention-visualization',
  INTEGRATED_GRADIENTS: '/integrated-gradients',
  GCN_AGGREGATION: '/visualize-gcn-aggregation',
  VISUALIZE_GCN_AGGREGATION: '/visualize-gcn-aggregation',
  WX_EXPLANATION_INTEGRATED_GRADIENTS: '/wx-explanations/integrated-gradients',
  WX_EXPLANATION_GCN: '/wx-explanations/gcn-message-passing',
  WX_EXPLANATION_RESULT: (jobId) => `/wx-explanations/${encodeURIComponent(jobId)}`,
  MODEL_GRAPH: '/model-graph'
};

module.exports = {
  ENVIRONMENTS, CURRENT_ENV, CLIENT_BUILD_ID, API_SERVERS: config.apiOrigins,
  ENDPOINTS, getCurrentServerIndex, switchToNextServer, resetServerIndex,
  getApiBaseUrl, getWebBaseUrl, buildApiUrl, normalizeWebPath, buildWebUrl,
  buildEmbedResultsUrl, isTrustedWebUrl
};
