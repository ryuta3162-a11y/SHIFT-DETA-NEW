/** GAS API（GAS iframe / Vercel PWA 両対応） */

const isGas = () => typeof google !== 'undefined' && google?.script?.run;
const PWA_HOST = import.meta.env.VITE_PWA_HOST === '1';
const GAS_ENDPOINTS = [
  import.meta.env.VITE_GAS_ENDPOINT,
  'https://script.google.com/a/macros/okamoto-group.co.jp/s/AKfycbxp0HBE4-akd-bbMFzvkaAbFiBkxlK-m8W7HugP9nkYx0LEs8kwu1sjdo54AABZuijv/exec',
  'https://script.google.com/macros/s/AKfycbxp0HBE4-akd-bbMFzvkaAbFiBkxlK-m8W7HugP9nkYx0LEs8kwu1sjdo54AABZuijv/exec',
].filter(Boolean);
const GAS_PROXY = '/api/gas';
const REQUEST_TIMEOUT_MS = 45000;
// 反映・一括保存はシート書き込みが重いので待ち時間を長めにする
const HEAVY_ACTIONS = new Set([
  'generateMonthlyShifts',
  'saveWeeklySchedule',
  'upsertShiftsBatch',
  'upsertMemosBatch',
  'syncCalendarMonth',
  'clearCalendarMonth',
]);
const timeoutFor = (fnName) => (HEAVY_ACTIONS.has(fnName) ? 110000 : REQUEST_TIMEOUT_MS);

function actionParams(fnName, args) {
  switch (fnName) {
    case 'getBootstrap':
      return { action: 'getBootstrap' };
    case 'loginWithEmail':
      return { action: 'loginWithEmail', email: args[0] };
    case 'staffVerifyIdentity':
      return { action: 'staffVerifyIdentity', byeCode: args[0], name: args[1] };
    case 'staffSetPassword':
      return { action: 'staffSetPassword', byeCode: args[0], name: args[1], password: args[2] };
    case 'staffLogin':
      return { action: 'staffLogin', byeCode: args[0], password: args[1] };
    case 'staffResumeSession':
      return { action: 'staffResumeSession', token: args[0] };
    case 'saveJurisdiction':
      return { action: 'saveJurisdiction', payload: JSON.stringify(args[0]) };
    case 'listEmployees':
      return { action: 'listEmployees', storeId: args[0], userEmail: args[1] };
    case 'upsertEmployee':
      return { action: 'upsertEmployee', payload: JSON.stringify(args[0]) };
    case 'saveEmployeeOrder':
      return { action: 'saveEmployeeOrder', payload: JSON.stringify(args[0]) };
    case 'deactivateEmployee':
      return { action: 'deactivateEmployee', employeeId: args[0], storeId: args[1], userEmail: args[2] };
    case 'getWeeklySchedule':
      return { action: 'getWeeklySchedule', storeId: args[0], userEmail: args[1] };
    case 'saveWeeklySchedule':
      return { action: 'saveWeeklySchedule', payload: JSON.stringify(args[0]) };
    case 'getShifts':
      return {
        action: 'getShifts',
        storeId: args[0],
        yearMonth: args[1],
        userEmail: args[2],
        ...(args[3] === false || args[3] === 0 || args[3] === '0' || args[3] === 'false'
          ? { applyWeekly: '0' }
          : {}),
      };
    case 'generateMonthlyShifts':
      return { action: 'generateMonthlyShifts', payload: JSON.stringify(args[0]) };
    case 'upsertShift':
      return { action: 'upsertShift', payload: JSON.stringify(args[0]) };
    case 'upsertShiftsBatch':
      return { action: 'upsertShiftsBatch', payload: JSON.stringify(args[0]) };
    case 'upsertMemosBatch':
      return { action: 'upsertMemosBatch', payload: JSON.stringify(args[0]) };
    case 'deleteShift':
      return { action: 'deleteShift', shiftId: args[0], storeId: args[1], userEmail: args[2] };
    case 'buildByeByePaste':
      return { action: 'buildByeByePaste', storeId: args[0], yearMonth: args[1], userEmail: args[2] };
    case 'syncCalendarMonth':
      return { action: 'syncCalendarMonth', payload: JSON.stringify(args[0]) };
    case 'clearCalendarMonth':
      return { action: 'clearCalendarMonth', payload: JSON.stringify(args[0]) };
    case 'listStoreChat':
      return { action: 'listStoreChat', storeId: args[0], userEmail: args[1], limit: args[2] || 80 };
    case 'postStoreChat':
      return { action: 'postStoreChat', payload: JSON.stringify(args[0]) };
    case 'deleteStoreChat':
      return { action: 'deleteStoreChat', payload: JSON.stringify(args[0]) };
    default:
      throw new Error(`PWA API 未対応: ${fnName}`);
  }
}

function runGas(fnName, args) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      fn(value);
    };
    const timeoutId = window.setTimeout(
      () => finish(reject, new Error('サーバーの応答が遅れています。少し待って画面を更新してください。')),
      timeoutFor(fnName)
    );
    google.script.run
      .withSuccessHandler((data) => finish(resolve, data))
      .withFailureHandler((err) => finish(reject, err?.message ? err : new Error(String(err))))
      [fnName](...args);
  });
}

function isUsablePayload(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.ok === false) return false;
  return true;
}

function apiViaJsonp(params, endpoint, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const callbackName = `shiftCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const search = new URLSearchParams({ ...params, callback: callbackName });
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      script.remove();
      delete window[callbackName];
      fn(value);
    };
    const timeoutId = window.setTimeout(
      () => finish(reject, new Error('サーバーの応答が遅れています。少し待って画面を更新してください。')),
      timeoutMs
    );
    window[callbackName] = (data) => finish(resolve, data);
    script.onerror = () => finish(reject, new Error('request failed'));
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = `${endpoint}?${search.toString()}`;
    document.body.appendChild(script);
  });
}

function apiViaProxy(params, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
      reject(new Error('サーバーの応答が遅れています。少し待って画面を更新してください。'));
    }, timeoutMs);
    const search = new URLSearchParams(params);
    fetch(`${GAS_PROXY}?${search.toString()}`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        window.clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`proxy HTTP ${response.status}`);
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('invalid proxy response');
        }
        if (!isUsablePayload(data)) {
          throw new Error(data?.message || 'proxy unusable');
        }
        resolve(data);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function canUseProxy() {
  return PWA_HOST && /^https?:$/i.test(window.location.protocol);
}

async function apiOnce(fnName, args) {
  const params = actionParams(fnName, args);
  const errors = [];
  const timeoutMs = timeoutFor(fnName);
  if (canUseProxy()) {
    try {
      return await apiViaProxy(params, Math.min(timeoutMs, 58000));
    } catch (error) {
      errors.push(error);
    }
  }
  for (const endpoint of GAS_ENDPOINTS) {
    try {
      const data = await apiViaJsonp(params, endpoint, timeoutMs);
      if (!isUsablePayload(data)) {
        throw new Error(data?.message || 'jsonp unusable');
      }
      return data;
    } catch (error) {
      errors.push(error);
    }
  }
  throw errors[errors.length - 1] || new Error('request failed');
}

async function runRemote(fnName, args) {
  const data = await apiOnce(fnName, args);
  if (data && data.ok === false && data.message) {
    throw new Error(data.message);
  }
  return data;
}

function run(fnName, ...args) {
  if (isGas()) return runGas(fnName, args);
  if (PWA_HOST) return runRemote(fnName, args);
  return Promise.reject(new Error('GAS 上で開くか、スタッフ用アプリ URL をご利用ください'));
}

export const api = {
  getBootstrap: () => run('getBootstrap'),
  loginWithEmail: (email) => run('loginWithEmail', email),
  staffVerifyIdentity: (byeCode, name) => run('staffVerifyIdentity', byeCode, name),
  staffSetPassword: (byeCode, name, password) => run('staffSetPassword', byeCode, name, password),
  staffLogin: (byeCode, password) => run('staffLogin', byeCode, password),
  staffResumeSession: (token) => run('staffResumeSession', token),
  saveJurisdiction: (payload) => run('saveJurisdiction', payload),
  listEmployees: (storeId, userEmail) => run('listEmployees', storeId, userEmail),
  upsertEmployee: (payload) => run('upsertEmployee', payload),
  saveEmployeeOrder: (payload) => run('saveEmployeeOrder', payload),
  deactivateEmployee: (employeeId, storeId, userEmail) => run('deactivateEmployee', employeeId, storeId, userEmail),
  getWeeklySchedule: (storeId, userEmail) => run('getWeeklySchedule', storeId, userEmail),
  saveWeeklySchedule: (payload) => run('saveWeeklySchedule', payload),
  getShifts: (storeId, yearMonth, userEmail, applyWeekly) =>
    run('getShifts', storeId, yearMonth, userEmail, applyWeekly),
  generateMonthlyShifts: (payload) => run('generateMonthlyShifts', payload),
  upsertShift: (payload) => run('upsertShift', payload),
  upsertShiftsBatch: (payload) => run('upsertShiftsBatch', payload),
  upsertMemosBatch: (payload) => run('upsertMemosBatch', payload),
  deleteShift: (shiftId, storeId, userEmail) => run('deleteShift', shiftId, storeId, userEmail),
  buildByeByePaste: (storeId, yearMonth, userEmail) => run('buildByeByePaste', storeId, yearMonth, userEmail),
  syncCalendarMonth: (payload) => run('syncCalendarMonth', payload),
  clearCalendarMonth: (payload) => run('clearCalendarMonth', payload),
  listStoreChat: (storeId, userEmail, limit) => run('listStoreChat', storeId, userEmail, limit),
  postStoreChat: (payload) => run('postStoreChat', payload),
  deleteStoreChat: (payload) => run('deleteStoreChat', payload),
};
