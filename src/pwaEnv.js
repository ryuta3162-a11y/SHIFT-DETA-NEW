/** PWA / スタンドアロン判定 */

export function isStandaloneApp() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

export function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

export function isIosSafari() {
  const ua = navigator.userAgent || '';
  if (!isIos()) return false;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Line\/|FBAN|FBAV|Instagram/i.test(ua);
}

export function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /Line\//i.test(ua) || /FBAV/i.test(ua) || /Instagram/i.test(ua);
}
