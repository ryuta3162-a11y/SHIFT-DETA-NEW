import { useMemo, useState } from 'react';
import { BrandTitle } from './BrandTitle.jsx';
import { APP_TAGLINE } from './appBrand.js';

const TABS = [
  { id: 'home', label: 'ホーム', icon: IconHome },
  { id: 'hope', label: '希望', icon: IconHope },
  { id: 'schedule', label: '勤務', icon: IconSchedule },
  { id: 'board', label: '掲示板', icon: IconBoard },
];

const FEATURES = [
  { id: 'hope', title: '希望シフト', desc: '2か月先まで、働きたい日時を入力', icon: IconHope, tone: 'sky' },
  { id: 'schedule', title: '勤務状況', desc: '店舗スタッフの確定シフトを確認', icon: IconSchedule, tone: 'violet' },
  { id: 'board', title: '掲示板', desc: '店舗からのお知らせをチェック', icon: IconBoard, tone: 'amber' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'おはようございます';
  if (h < 17) return 'こんにちは';
  return 'お疲れさまです';
}

function IconHome({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function IconHope({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 13.5h3M8.5 16.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconSchedule({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v4.5l3 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBoard({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 5.5h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.2L5 19.8V7.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 10.5h7M8.5 13.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconLogout({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h6A1.5 1.5 0 0 1 19 5.5v13A1.5 1.5 0 0 1 17.5 20h-6A1.5 1.5 0 0 1 10 18.5V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 12h9M13.5 8.5 17 12l-3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ComingSoon({ title, desc, icon: Icon }) {
  return (
    <div className="staff-empty">
      <div className="staff-empty__icon"><Icon className="w-8 h-8" /></div>
      <p className="staff-empty__title">{title}</p>
      <p className="staff-empty__desc">{desc}</p>
      <span className="staff-chip">準備中</span>
    </div>
  );
}

function StaffHome({ user, storeName, onNavigate }) {
  return (
    <div className="staff-home">
      <section className="staff-hero-card">
        <p className="staff-hero-card__greet">{greeting()}</p>
        <p className="staff-hero-card__name">{user?.name} さん</p>
        <p className="staff-hero-card__store">{storeName}</p>
        <p className="staff-hero-card__tagline">{APP_TAGLINE.replace(/\n/g, '')}</p>
      </section>
      <p className="staff-section-label">メニュー</p>
      <div className="staff-feature-grid">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <button key={f.id} type="button" className={`staff-feature-card staff-feature-card--${f.tone}`} onClick={() => onNavigate(f.id)}>
              <span className="staff-feature-card__icon"><Icon className="w-6 h-6" /></span>
              <span className="staff-feature-card__title">{f.title}</span>
              <span className="staff-feature-card__desc">{f.desc}</span>
              <span className="staff-chip staff-chip--inline">準備中</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StaffApp({ user, storeName, onLogout }) {
  const [tab, setTab] = useState('home');

  const panel = useMemo(() => {
    if (tab === 'hope') return <ComingSoon title="希望シフト" desc="2か月先までの希望を入力できるようになります" icon={IconHope} />;
    if (tab === 'schedule') return <ComingSoon title="勤務状況" desc="店舗の確定シフトを一覧で確認できます" icon={IconSchedule} />;
    if (tab === 'board') return <ComingSoon title="掲示板" desc="店舗からのお知らせをここで確認できます" icon={IconBoard} />;
    return <StaffHome user={user} storeName={storeName} onNavigate={setTab} />;
  }, [tab, user, storeName]);

  return (
    <div className="staff-shell">
      <div className="staff-shell__bg" aria-hidden="true" />
      <header className="staff-header">
        <div className="staff-header__brand">
          <BrandTitle size="compact" />
          <span className="staff-header__badge">スタッフ</span>
        </div>
        <button type="button" className="staff-header__logout" onClick={onLogout} aria-label="ログアウト">
          <IconLogout />
        </button>
      </header>
      <main className="staff-main">{panel}</main>
      <nav className="staff-tabbar" aria-label="メインメニュー">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" className={`staff-tabbar__item${on ? ' staff-tabbar__item--on' : ''}`} onClick={() => setTab(t.id)} aria-current={on ? 'page' : undefined}>
              <Icon className="w-[1.35rem] h-[1.35rem]" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
