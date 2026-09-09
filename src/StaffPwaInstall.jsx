import { useEffect } from 'react';

const INSTALL_DISMISS_KEY = 'shiftone_install_dismissed';

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function isIosSafari() {
  const ua = navigator.userAgent || '';
  if (!isIos()) return false;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Line\/|FBAN|FBAV|Instagram/i.test(ua);
}

function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /Line\//i.test(ua) || /FBAV/i.test(ua) || /Instagram/i.test(ua);
}

/** 9周年イベントと同じインストール案内（Vercel PWA 専用） */
export function StaffPwaInstall() {
  useEffect(() => {
    if (isStandaloneApp() || localStorage.getItem(INSTALL_DISMISS_KEY) === '1') return;

    const banner = document.getElementById('staffInstallBanner');
    const title = document.getElementById('staffInstallTitle');
    const yes = document.getElementById('staffInstallYes');
    const no = document.getElementById('staffInstallNo');
    const hint = document.getElementById('staffInstallHint');
    const status = document.getElementById('staffInstallStatus');
    const statusTitle = document.getElementById('staffInstallStatusTitle');
    const statusText = document.getElementById('staffInstallStatusText');
    const statusSpin = document.getElementById('staffInstallStatusSpin');
    const statusClose = document.getElementById('staffInstallStatusClose');
    if (!banner || !title || !yes || !no || !hint) return;

    const showBanner = () => banner.classList.add('show');
    const hideBanner = () => banner.classList.remove('show');
    const hideInstallButton = () => { yes.hidden = true; };

    no.onclick = () => {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1');
      hideBanner();
    };

    if (isIos()) {
      hideInstallButton();
      if (!isIosSafari() || isInAppBrowser()) {
        title.textContent = 'Safariで開いてください';
        hint.textContent = 'iPhoneはSafariだけホーム画面に追加できます。ChromeやLINEの中では追加できません。';
      } else {
        title.textContent = 'ホーム画面に追加';
        hint.innerHTML = '① 下（または上）の四角と矢印の共有ボタン<br>② 「ホーム画面に追加」を選ぶ<br>③ 「追加」を押す';
      }
      showBanner();
      return;
    }

    if (isInAppBrowser()) {
      title.textContent = 'Chromeで開いてください';
      hint.textContent = 'この画面のままではアプリにできません。ブラウザで開いてからインストールしてください。';
      yes.hidden = false;
      yes.textContent = 'Chromeで開く';
      yes.onclick = () => {
        const target = window.location.href.replace(/^https:\/\//, '');
        window.location.href = `intent://${target}#Intent;scheme=https;package=com.android.chrome;end`;
      };
      showBanner();
      return;
    }

    let deferredPrompt = null;
    let installLocked = false;

    const showInstallWaiting = () => {
      hideBanner();
      if (!status || !statusTitle) return;
      if (statusSpin) statusSpin.hidden = false;
      if (statusClose) statusClose.hidden = true;
      if (statusText) {
        statusText.hidden = true;
        statusText.textContent = '';
      }
      statusTitle.textContent = 'インストール中';
      status.classList.add('show');
      status.setAttribute('aria-hidden', 'false');
    };

    const showInstallDone = () => {
      hideBanner();
      if (!status || !statusTitle || !statusText) return;
      if (statusSpin) statusSpin.hidden = true;
      if (statusClose) statusClose.hidden = false;
      statusTitle.textContent = '完了しました';
      statusText.textContent = 'アプリから起動してみてください。';
      statusText.hidden = false;
      status.classList.add('show');
      status.setAttribute('aria-hidden', 'false');
    };

    if (statusClose) {
      statusClose.onclick = () => {
        status.classList.remove('show');
        status.setAttribute('aria-hidden', 'true');
      };
    }

    const showInstallReady = () => {
      if (installLocked) return;
      title.textContent = 'アプリを追加できます';
      hint.textContent = 'このボタンを押すと、そのままインストールできます。';
      yes.hidden = false;
      yes.textContent = 'インストール';
      showBanner();
    };

    const onBeforeInstall = (event) => {
      event.preventDefault();
      deferredPrompt = event;
      showInstallReady();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    yes.onclick = async () => {
      if (!deferredPrompt || installLocked) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (!(choice && choice.outcome === 'accepted')) return;
      installLocked = true;
      showInstallWaiting();
      window.setTimeout(showInstallDone, 10000);
    };

    const afterReady = ('serviceWorker' in navigator)
      ? navigator.serviceWorker.ready
      : Promise.resolve();
    afterReady.then(() => {
      window.setTimeout(() => {
        if (deferredPrompt || installLocked || isStandaloneApp()) return;
        hideInstallButton();
        title.textContent = 'アプリにするには';
        hint.innerHTML = 'Chromeの右上メニュー「⋮」から<br>「アプリをインストール」を選んでください。<br><b>「ショートカットを追加」だとアプリになりません。</b>';
        showBanner();
      }, 8000);
    }).catch(() => {});

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  return (
    <>
      <div className="staff-pwa-install-banner" id="staffInstallBanner" aria-live="polite">
        <strong id="staffInstallTitle">アプリをインストール</strong>
        <p id="staffInstallHint">ホーム画面に追加して、いつでもすぐ開けます</p>
        <div className="staff-pwa-install-banner__row">
          <button type="button" className="staff-pwa-install-banner__yes" id="staffInstallYes">インストール</button>
          <button type="button" className="staff-pwa-install-banner__no" id="staffInstallNo">あとで</button>
        </div>
      </div>
      <div className="staff-pwa-install-status" id="staffInstallStatus" aria-hidden="true">
        <div className="staff-pwa-install-status__panel">
          <div className="staff-pwa-install-status__spin" id="staffInstallStatusSpin" aria-hidden="true" />
          <strong id="staffInstallStatusTitle">インストール中</strong>
          <p id="staffInstallStatusText" hidden />
          <button type="button" className="staff-pwa-install-status__close" id="staffInstallStatusClose" hidden>OK</button>
        </div>
      </div>
    </>
  );
}
