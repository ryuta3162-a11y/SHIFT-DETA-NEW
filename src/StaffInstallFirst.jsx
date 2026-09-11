import { useEffect, useRef, useState } from 'react';
import { AppIconMark } from './AppIconMark.jsx';
import { BrandTitle } from './BrandTitle.jsx';
import { IconLoginArrow } from './LoginHero.jsx';
import { isInAppBrowser, isIos, isIosSafari } from './pwaEnv.js';

/** Vercel（ブラウザ）専用：インストール案内 → 完了画面で止める */
export function StaffInstallFirst() {
  const [title, setTitle] = useState('SHIFT:ONE をインストール');
  const [hint, setHint] = useState('ホーム画面に追加して、いつでもすぐ開けます');
  const [btnLabel, setBtnLabel] = useState('インストール');
  const [btnHidden, setBtnHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const installHandler = useRef(null);

  useEffect(() => {
    let deferredPrompt = null;
    let installLocked = false;

    const onBeforeInstall = (event) => {
      event.preventDefault();
      deferredPrompt = event;
      setTitle('アプリを追加できます');
      setHint('このボタンを押すと、そのままインストールできます');
      setBtnLabel('インストール');
      setBtnHidden(false);
    };

    const onInstalled = () => {
      installLocked = true;
      setStatus('done');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    if (isIos()) {
      setBtnHidden(true);
      if (!isIosSafari() || isInAppBrowser()) {
        setTitle('Safariで開いてください');
        setHint('iPhoneはSafariだけホーム画面に追加できます。ChromeやLINEの中では追加できません。');
      } else {
        setTitle('ホーム画面に追加');
        setHint('① 共有ボタン（□↑）→ ②「ホーム画面に追加」→ ③「追加」');
      }
    } else if (isInAppBrowser()) {
      setTitle('Chromeで開いてください');
      setHint('この画面のままではアプリにできません。ブラウザで開いてからインストールしてください。');
      setBtnLabel('Chromeで開く');
      setBtnHidden(false);
    } else {
      window.setTimeout(() => {
        if (deferredPrompt || installLocked) return;
        setBtnHidden(true);
        setTitle('アプリにするには');
        setHint('Chrome右上の ⋮ →「アプリをインストール」を選んでください');
      }, 8000);
    }

    installHandler.current = async () => {
      if (isInAppBrowser()) {
        const target = window.location.href.replace(/^https:\/\//, '');
        window.location.href = `intent://${target}#Intent;scheme=https;package=com.android.chrome;end`;
        return;
      }
      if (!deferredPrompt || installLocked) return;
      setBusy(true);
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      setBusy(false);
      if (!(choice && choice.outcome === 'accepted')) return;
      installLocked = true;
      setStatus('waiting');
      window.setTimeout(() => setStatus('done'), 2500);
    };

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (installHandler.current) await installHandler.current();
  }

  if (status === 'waiting' || status === 'done') {
    return (
      <div className="staff-install-screen">
        <div className="staff-install-screen__bg" aria-hidden="true" />
        <div className="staff-install-screen__inner staff-install-screen__inner--complete">
          {status === 'waiting' ? (
            <>
              <div className="staff-pwa-install-status__spin" aria-hidden="true" />
              <p className="staff-install-screen__welcome">インストール中…</p>
            </>
          ) : (
            <>
              <div className="install-complete-check" aria-hidden="true">
                <svg viewBox="0 0 52 52" fill="none">
                  <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2" opacity="0.35" />
                  <path d="M14 27l8 8 16-18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="staff-install-screen__title install-complete-title">インストールが完了しました</p>
              <AppIconMark size="compact" />
              <p className="staff-install-screen__lead install-complete-lead">
                ホーム画面の <strong>SHIFT:ONE</strong> アイコンから開いてください
              </p>
              <p className="install-complete-note">
                操作はアプリから行います。このブラウザのタブは閉じて大丈夫です
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="staff-install-screen">
      <div className="staff-install-screen__bg" aria-hidden="true" />
      <div className="staff-install-screen__inner">
        <header className="staff-install-screen__hero">
          <AppIconMark size="hero" />
          <BrandTitle size="compact" />
        </header>

        <div className="staff-install-screen__card">
          <p className="staff-install-screen__card-heading">{title}</p>
          <p className="staff-install-screen__card-hint">{hint}</p>
        </div>

        {!btnHidden && (
          <button
            type="button"
            className="staff-install-screen__primary"
            disabled={busy}
            onClick={handleInstall}
          >
            <span>{busy ? '処理中…' : btnLabel}</span>
            {!busy && <IconLoginArrow className="w-5 h-5" />}
          </button>
        )}

        <p className="staff-install-screen__web-note">
          インストール後は、ホーム画面のアイコンから開いてください
        </p>
      </div>
    </div>
  );
}
