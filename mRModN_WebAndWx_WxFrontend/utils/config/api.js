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
    webBasePath: '/mrmodn'
  },
  production: {
    apiOrigins: [
      'https://cmb.bnu.edu.cn',
      'https://rgcnformer.dawdawdawdawfafaawf.xyz'
    ],
    appBasePath: '/mrmodn',
    apiPrefix: '/api/v1',
    webOrigin: 'https://cmb.bnu.edu.cn',
    webBasePath: '/mrmodn'
  }
};

// 手动环境开关：内网联调使用 'lan'，发布前改为 'production'。
const CURRENT_ENV = 'lan';
const config = ENVIRONMENTS[CURRENT_ENV];
const STORAGE_KEY = 'mrmodnApiServerIndex';

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
function buildWebUrl(path) { return joinUrl(getWebBaseUrl(), path); }
function isTrustedWebUrl(url) {
  try {
    const expected = `${config.webOrigin}${config.webBasePath}`;
    return url === expected || url.startsWith(`${expected}/`) || url.startsWith(`${expected}?`);
  } catch (e) { return false; }
}

const ENDPOINTS = {
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
  MODEL_GRAPH: '/model-graph'
};

module.exports = {
  ENVIRONMENTS, CURRENT_ENV, API_SERVERS: config.apiOrigins,
  ENDPOINTS, getCurrentServerIndex, switchToNextServer, resetServerIndex,
  getApiBaseUrl, getWebBaseUrl, buildApiUrl, buildWebUrl, isTrustedWebUrl
};
