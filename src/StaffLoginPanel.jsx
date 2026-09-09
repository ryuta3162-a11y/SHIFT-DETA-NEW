import { useEffect, useState } from 'react';
import { IconLoginArrow } from './LoginHero.jsx';
import { STAFF_CODE_KEY, validateStaffPassword } from './staffAuth.js';

const inputCls = 'login-form-input';
const labelCls = 'login-form-label';

/** 登録／ログイン（シンプル） */
export function StaffLoginPanel({
  busy,
  error,
  onVerify,
  onSetPassword,
  onLogin,
  initialPhase = 'login',
}) {
  const [phase, setPhase] = useState(initialPhase);
  const [byeCode, setByeCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [localError, setLocalError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STAFF_CODE_KEY) || '';
    if (saved) setByeCode(saved);
  }, []);

  const err = localError || error;

  async function handleRegister(e) {
    e.preventDefault();
    setLocalError('');
    setInfo('');
    const code = String(byeCode || '').trim();
    const nm = String(name || '').trim();
    if (!code || !nm) {
      setLocalError('社員コードと氏名を入力してください');
      return;
    }
    const pwErr = validateStaffPassword(password, code);
    if (pwErr) {
      setLocalError(pwErr);
      return;
    }
    if (password !== password2) {
      setLocalError('確認用パスワードが一致しません');
      return;
    }
    try {
      const res = await onVerify(code, nm);
      if (!res.needsPassword) {
        setPhase('login');
        setPassword('');
        setPassword2('');
        setInfo('登録済みです。パスワードでログインしてください。');
        return;
      }
      await onSetPassword(code, nm, password);
    } catch (ex) {
      setLocalError(ex.message || String(ex));
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLocalError('');
    setInfo('');
    const code = String(byeCode || '').trim();
    if (!code || !password) {
      setLocalError('社員コードとパスワードを入力してください');
      return;
    }
    try {
      await onLogin(code, password);
    } catch (ex) {
      setLocalError(ex.message || String(ex));
    }
  }

  return (
    <div className="login-card-float">
      <div className="login-mode-tabs mb-3">
        <button
          type="button"
          className={`login-mode-tab ${phase === 'login' ? 'login-mode-tab--on' : ''}`}
          onClick={() => { setPhase('login'); setLocalError(''); setInfo(''); }}
        >
          ログイン
        </button>
        <button
          type="button"
          className={`login-mode-tab ${phase === 'register' ? 'login-mode-tab--on' : ''}`}
          onClick={() => { setPhase('register'); setLocalError(''); setInfo(''); }}
        >
          登録
        </button>
      </div>

      <h2 className="login-card-title">{phase === 'login' ? 'ログイン' : '登録'}</h2>

      {phase === 'login' ? (
        <form className="space-y-4 mt-5" onSubmit={handleLogin} autoComplete="on">
          {info && (
            <p className="text-[13px] font-semibold text-[#1565c0] leading-relaxed whitespace-pre-wrap">{info}</p>
          )}
          <div>
            <label className={labelCls} htmlFor="staff-username">社員コード</label>
            <input
              id="staff-username"
              name="username"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              enterKeyHint="next"
              spellCheck={false}
              value={byeCode}
              onChange={(e) => setByeCode(e.target.value)}
              className={inputCls}
              placeholder="304642"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="staff-password">パスワード</label>
            <input
              id="staff-password"
              name="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          {err && <p className="text-rose-600 text-sm font-semibold leading-relaxed whitespace-pre-wrap">{err}</p>}
          <button type="submit" disabled={busy} className="login-submit">
            <span>ログイン</span>
            <IconLoginArrow />
          </button>
        </form>
      ) : (
        <form className="space-y-3.5 mt-5" onSubmit={handleRegister} autoComplete="on">
          <div>
            <label className={labelCls} htmlFor="staff-reg-username">社員コード</label>
            <input
              id="staff-reg-username"
              name="username"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              enterKeyHint="next"
              spellCheck={false}
              value={byeCode}
              onChange={(e) => setByeCode(e.target.value)}
              className={inputCls}
              placeholder="304642"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="staff-reg-name">氏名</label>
            <input
              id="staff-reg-name"
              name="name"
              type="text"
              autoComplete="name"
              enterKeyHint="next"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="澤野 郁哉"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="staff-reg-password">パスワード</label>
            <input
              id="staff-reg-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="staff-reg-password2">パスワード（確認）</label>
            <input
              id="staff-reg-password2"
              name="new-password-confirm"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className={inputCls}
            />
          </div>
          {err && <p className="text-rose-600 text-sm font-semibold leading-relaxed whitespace-pre-wrap" role="alert">{err}</p>}
          <button type="submit" disabled={busy} className="login-submit">
            <span>{busy ? '登録中…' : '登録する'}</span>
            <IconLoginArrow />
          </button>
        </form>
      )}
    </div>
  );
}
