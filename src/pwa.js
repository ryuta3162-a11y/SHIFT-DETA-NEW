import { APP_NAME, APP_TAGLINE } from './appBrand.js';

let deferredInstallPrompt = null;
const installListeners = new Set();

export function isStaffAppMode() {
  try {
    return new URLSearchParams(window.location.search).get('mode') === 'staff';
  } catch {
    return false;
  }
}

export function isStandaloneDisplay() {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

/** LINE・Instagram 等のアプリ内ブラウザ */
export function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /Line\//i.test(ua)
    || /FBAV/i.test(ua)
    || /Instagram/i.test(ua)
    || /Twitter/i.test(ua)
    || /MicroMessenger/i.test(ua);
}

export function isInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isRestrictedInstallContext() {
  return isInAppBrowser() || isInIframe();
}

export function getInstallPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function canNativeInstall() {
  return !!deferredInstallPrompt;
}

export function subscribeInstallReady(cb) {
  installListeners.add(cb);
  cb(canNativeInstall());
  return () => installListeners.delete(cb);
}

function notifyInstallReady() {
  installListeners.forEach((cb) => cb(canNativeInstall()));
}

export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    notifyInstallReady();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyInstallReady();
  });
}

function waitForInstallPrompt(ms = 2500) {
  if (deferredInstallPrompt) return Promise.resolve(true);
  return new Promise((resolve) => {
    let n = 0;
    const max = Math.ceil(ms / 100);
    const timer = setInterval(() => {
      if (deferredInstallPrompt) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (++n >= max) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

/** ボタン1タップでインストールダイアログを出す（Android Chrome） */
export async function triggerNativeInstall() {
  await waitForInstallPrompt();
  if (!deferredInstallPrompt) return { ok: false, reason: 'unavailable' };
  try {
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    notifyInstallReady();
    if (choice.outcome === 'accepted') return { ok: true };
    return { ok: false, reason: 'dismissed' };
  } catch {
    deferredInstallPrompt = null;
    notifyInstallReady();
    return { ok: false, reason: 'error' };
  }
}

export function shouldShowInstallGate() {
  return !isStandaloneDisplay();
}

function execBase() {
  const base = window.__SHIFT_EXEC_BASE__;
  if (base) return String(base).replace(/\/$/, '');
  return `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '');
}

function ensureLink(rel, attrs) {
  if (document.querySelector(`link[rel="${rel}"]`)) return;
  const el = document.createElement('link');
  el.rel = rel;
  Object.entries(attrs).forEach(([k, v]) => {
    if (v != null) el.setAttribute(k, v);
  });
  document.head.appendChild(el);
}

function ensureMeta(name, content) {
  if (document.querySelector(`meta[name="${name}"]`)) return;
  const el = document.createElement('meta');
  el.name = name;
  el.content = content;
  document.head.appendChild(el);
}

/** React 起動後のフォールバック（doGet 側で先に注入済み） */
export function initPwa() {
  const base = execBase();
  ensureLink('manifest', { href: `${base}?pwa=manifest` });
  ensureLink('apple-touch-icon', { href: `${base}?pwa=icon` });
  ensureMeta('theme-color', '#1565c0');
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  ensureMeta('apple-mobile-web-app-title', APP_NAME);
  ensureMeta('mobile-web-app-capable', 'yes');
  ensureMeta('application-name', APP_NAME);
  ensureMeta('description', APP_TAGLINE.replace(/\n/g, ''));
}

export function getStaffShareUrl() {
  const base = execBase();
  return `${base}?mode=staff`;
}
