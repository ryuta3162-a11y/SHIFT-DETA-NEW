import { LOGIN_FEATURES } from './appBrand.js';
import { BrandTitle } from './BrandTitle.jsx';

/** シフト表 — 一元管理 */
function IconFeatureShift({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
      <path d="M9.5 7h9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="12" r="1" fill="currentColor" />
      <path d="M9.5 12h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="16.5" r="1" fill="currentColor" />
      <path d="M9.5 16.5h8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Googleカレンダー連携 */
function IconFeatureCalendar({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="8" y="13" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="13" y="13" width="3" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** 報連相・メモ — チャット吹き出し */
function IconFeatureChat({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 5.5h12a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H9.2L5 19.8V7.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="11.5" r="0.9" fill="currentColor" />
      <circle cx="12" cy="11.5" r="0.9" fill="currentColor" />
      <circle cx="14.5" cy="11.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

const FEATURE_ICONS = [IconFeatureShift, IconFeatureCalendar, IconFeatureChat];

export function LoginHeroCopy({ tagline }) {
  return (
    <div className="login-hero-copy">
      <BrandTitle />
      <p className="login-tagline">{tagline}</p>
      <ul className="login-features">
        {LOGIN_FEATURES.map((line, i) => {
          const Icon = FEATURE_ICONS[i] || IconFeatureShift;
          return (
            <li key={line}>
              <span className="login-feature-icon"><Icon /></span>
              <span className="login-feature-text">{line}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LoginBgDecor() {
  return (
    <>
      <div className="login-bg-glow login-bg-glow--a" aria-hidden="true" />
      <div className="login-bg-glow login-bg-glow--b" aria-hidden="true" />
    </>
  );
}

export function IconLoginArrow({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h12M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 初回ロード・スプラッシュ */
export function LoginLoadingPanel({ message = '読み込み中…' }) {
  return (
    <div className="login-loading" role="status" aria-live="polite">
      <div className="login-loading-spinner" aria-hidden="true">
        <div className="login-loading-ring" />
        <div className="login-loading-ring login-loading-ring--inner" />
      </div>
      <BrandTitle size="loading" />
      <p className="login-loading-text">{message}</p>
    </div>
  );
}
