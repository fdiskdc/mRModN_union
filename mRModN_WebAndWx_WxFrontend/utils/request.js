const api = require('./config/api');
const RETRYABLE_STATUS = [502, 503, 504];

function normalizeError(resOrError, fallbackMessage) {
  const statusCode = resOrError && resOrError.statusCode;
  const data = (resOrError && resOrError.data) || {};
  const message = data.message || data.error || (resOrError && resOrError.errMsg) || fallbackMessage || '请求失败';
  return {
    message,
    statusCode: statusCode || 0,
    code: data.code || data.errorType || 'REQUEST_FAILED',
    detail: data.detail || data,
    retryable: !statusCode || RETRYABLE_STATUS.includes(statusCode)
  };
}

function authHeader() {
  const token = wx.getStorageSync('sessionToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function requestWithFallback(endpoint, options = {}, maxAttempts) {
  const attempts = Math.min(maxAttempts || api.API_SERVERS.length, api.API_SERVERS.length);
  let attempt = 0;
  let task = null;
  let cancelled = false;

  const promise = new Promise((resolve, reject) => {
    const execute = () => {
      if (cancelled) return reject(normalizeError(null, '请求已取消'));
      const serverIndex = api.getCurrentServerIndex();
      const url = api.buildApiUrl(endpoint, serverIndex);
      task = wx.request({
        timeout: options.timeout || 20000,
        ...options,
        url,
        header: {
          'Content-Type': 'application/json',
          ...authHeader(),
          ...(options.header || {})
        },
        success(res) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, statusCode: res.statusCode, data: res.data, serverIndex });
            return;
          }
          const error = normalizeError(res);
          if (error.retryable && ++attempt < attempts) {
            api.switchToNextServer();
            execute();
          } else reject(error);
        },
        fail(err) {
          const error = normalizeError(err, '网络连接失败');
          if (++attempt < attempts) {
            api.switchToNextServer();
            execute();
          } else reject(error);
        }
      });
    };
    execute();
  });
  promise.abort = () => { cancelled = true; if (task) task.abort(); };
  return promise;
}

function requestLogin(options = {}) { return requestWithFallback(api.ENDPOINTS.WX_LOGIN, options); }
function resetServer() { api.resetServerIndex(); }

module.exports = {
  requestWithFallback, requestLogin, resetServer,
  getApiBaseUrl: api.getApiBaseUrl, getWebBaseUrl: api.getWebBaseUrl,
  normalizeError
};
