import { BrandTitle } from './BrandTitle.jsx';
import { LoginBgDecor } from './LoginHero.jsx';
import { StaffLoginPanel } from './StaffLoginPanel.jsx';

/** PWA ログイン */
export function StaffLoginShell({
  busy,
  busyText,
  error,
  onVerify,
  onSetPassword,
  onLogin,
}) {
  return (
    <div className="staff-login-shell">
      <div className="staff-login-shell__bg" aria-hidden="true">
        <LoginBgDecor />
      </div>

      {busy && (
        <div className="staff-login-shell__overlay">
          <div className="staff-login-shell__spinner" />
          <p>{busyText || '処理中…'}</p>
        </div>
      )}

      <div className="staff-login-shell__inner">
        <header className="staff-login-shell__hero">
          <BrandTitle />
        </header>

        <div className="staff-login-shell__card">
          <StaffLoginPanel
            busy={busy}
            error={error}
            onVerify={onVerify}
            onSetPassword={onSetPassword}
            onLogin={onLogin}
          />
        </div>
      </div>
    </div>
  );
}
