import { useCallback, useRef, useState } from 'react';
import { BrandTitle } from './BrandTitle.jsx';
import { AppIconMark } from './AppIconMark.jsx';
import { APP_TAGLINE } from './appBrand.js';
import { IconLoginArrow, LoginBgDecor } from './LoginHero.jsx';

/** 先頭＝初期表示。社員（水色）→ アルバイト（青） */
const ROLES = [
  {
    id: 'manager',
    badge: 'Employee',
    title: '社員',
    desc: 'この画面で登録・ログイン',
    cta: '社員としてはじめる',
    segment: '社員',
    icon: (
      <svg viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <rect x="12" y="14" width="32" height="30" rx="5" stroke="currentColor" strokeWidth="2.2" />
        <path d="M20 24h16M20 32h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M28 14V10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'staff',
    badge: 'Staff',
    title: 'アルバイト',
    desc: 'この画面で登録・ログイン',
    cta: 'アルバイトとしてはじめる',
    segment: 'アルバイト',
    icon: (
      <svg viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <circle cx="28" cy="20" r="9" stroke="currentColor" strokeWidth="2.2" />
        <path d="M12 46c0-8.8 7.2-16 16-16s16 7.2 16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const SWIPE_THRESHOLD = 52;

/** 左右対称スワイプ式ログイン種別選択 */
export function PwaRolePicker({ onPickStaff, onPickManager }) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const trackRef = useRef(null);

  const activeRole = ROLES[index];

  const goTo = useCallback((next) => {
    setIndex(Math.max(0, Math.min(ROLES.length - 1, next)));
    setDragX(0);
  }, []);

  function onPick(roleId) {
    if (roleId === 'staff') onPickStaff();
    else onPickManager();
  }

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    setDragging(true);
  }

  function onTouchMove(e) {
    if (!dragging) return;
    setDragX(e.touches[0].clientX - startX.current);
  }

  function onTouchEnd() {
    setDragging(false);
    if (dragX < -SWIPE_THRESHOLD) goTo(index + 1);
    else if (dragX > SWIPE_THRESHOLD) goTo(index - 1);
    else setDragX(0);
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    startX.current = e.clientX;
    setDragging(true);
  }

  function onMouseMove(e) {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  }

  function onMouseUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragX < -SWIPE_THRESHOLD) goTo(index + 1);
    else if (dragX > SWIPE_THRESHOLD) goTo(index - 1);
    else setDragX(0);
  }

  const offsetPct = -index * 100 + (dragging && trackRef.current
    ? (dragX / trackRef.current.offsetWidth) * 100
    : 0);

  return (
    <div
      className={`staff-login-shell pwa-swipe-shell pwa-swipe-shell--${activeRole.id}`}
      onMouseMove={dragging ? onMouseMove : undefined}
      onMouseUp={dragging ? onMouseUp : undefined}
      onMouseLeave={dragging ? onMouseUp : undefined}
    >
      <div className="staff-login-shell__bg" aria-hidden="true">
        <LoginBgDecor />
      </div>
      <div className={`pwa-swipe-ambient pwa-swipe-ambient--${activeRole.id}`} aria-hidden="true" />

      <div className="staff-login-shell__inner pwa-swipe-shell__inner">
        <header className="pwa-swipe-header">
          <AppIconMark size="compact" />
          <BrandTitle size="compact" />
          <p className="pwa-swipe-tagline">{APP_TAGLINE.replace(/\n/g, '')}</p>
        </header>

        <div className="pwa-swipe-segment" role="tablist" aria-label="ログイン種別">
          <div
            className={`pwa-swipe-segment__pill pwa-swipe-segment__pill--${activeRole.id}`}
            style={{ transform: `translateX(${index * 100}%)` }}
            aria-hidden="true"
          />
          {ROLES.map((role, i) => (
            <button
              key={role.id}
              type="button"
              role="tab"
              aria-selected={index === i}
              className={`pwa-swipe-segment__btn${index === i ? ' pwa-swipe-segment__btn--on' : ''}`}
              onClick={() => goTo(i)}
            >
              {role.segment}
            </button>
          ))}
        </div>

        <div className="pwa-swipe-carousel-wrap">
          <button
            type="button"
            className="pwa-swipe-nav pwa-swipe-nav--prev"
            aria-label="前へ"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            ‹
          </button>

          <div
            className="pwa-swipe-viewport"
            ref={trackRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
          >
            <div
              className={`pwa-swipe-track${dragging ? ' pwa-swipe-track--dragging' : ''}`}
              style={{ transform: `translateX(${offsetPct}%)` }}
            >
              {ROLES.map((role, i) => (
                <div
                  key={role.id}
                  className={`pwa-swipe-slide pwa-swipe-slide--${role.id}${index === i ? ' pwa-swipe-slide--active' : ''}`}
                >
                  <article className="pwa-swipe-card">
                    <div className="pwa-swipe-card__shine" aria-hidden="true" />
                    <div className={`pwa-swipe-card__icon pwa-swipe-card__icon--${role.id}`}>
                      {role.icon}
                    </div>
                    <span className={`pwa-swipe-card__badge pwa-swipe-card__badge--${role.id}`}>
                      {role.badge}
                    </span>
                    <h2 className="pwa-swipe-card__title">{role.title}</h2>
                    <p className="pwa-swipe-card__desc">{role.desc}</p>
                    <button
                      type="button"
                      className={`pwa-swipe-card__cta pwa-swipe-card__cta--${role.id}`}
                      onClick={() => onPick(role.id)}
                    >
                      <span>{role.cta}</span>
                      <IconLoginArrow className="w-[1.15rem] h-[1.15rem]" />
                    </button>
                  </article>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="pwa-swipe-nav pwa-swipe-nav--next"
            aria-label="次へ"
            disabled={index === ROLES.length - 1}
            onClick={() => goTo(index + 1)}
          >
            ›
          </button>
        </div>

        <p className="pwa-swipe-hint">
          <span className="pwa-swipe-hint__chev" aria-hidden="true">‹</span>
          スワイプで切り替え
          <span className="pwa-swipe-hint__chev" aria-hidden="true">›</span>
        </p>
      </div>
    </div>
  );
}
