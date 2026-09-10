import { useEffect, useMemo, useState } from 'react';
import { BrandTitle } from './BrandTitle.jsx';
import { APP_TAGLINE } from './appBrand.js';
import { api } from './api.js';
import { StoreChatPanel, useStoreChat } from './StoreChat.jsx';
import { STAFF_TOKEN_KEY } from './staffAuth.js';

const TABS = [
  { id: 'home', label: 'ホーム', icon: IconHome },
  { id: 'hope', label: '希望', icon: IconHope },
  { id: 'schedule', label: '勤務', icon: IconSchedule },
  { id: 'chat', label: 'チャット', icon: IconBoard },
];

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];
const STATUS_LABEL = { work: '出勤', off: '休み', pto: '有休', absent: '欠勤', undef: '未定' };

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'おはようございます';
  if (h < 17) return 'こんにちは';
  return 'お疲れさまです';
}

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftYm(ym, delta) {
  const [y, m] = String(ym || currentYm()).split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function formatYmJa(ym) {
  const [y, m] = String(ym || '').split('-');
  if (!y || !m) return ym;
  return `${y}年${Number(m)}月`;
}

function formatDateJa(ymd) {
  const s = String(ymd || '');
  const wd = new Date(`${s}T00:00:00`).getDay();
  if (!s || Number.isNaN(wd)) return s;
  const [, m, d] = s.split('-');
  return `${Number(m)}/${Number(d)}（${WEEKDAY[wd]}）`;
}

function daysInYm(ym) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
}

function empKey(id) {
  return String(id || '').replace(/^0+/, '') || String(id || '');
}

function shiftLabel(shift) {
  if (!shift) return '—';
  const st = String(shift.status || '');
  if (st === 'work' && shift.start_time && shift.end_time) {
    return `${shift.start_time}–${shift.end_time}`;
  }
  return STATUS_LABEL[st] || '—';
}

function buildTimeOptions(step = 30) {
  const out = [];
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += step) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}

const TIME_OPTIONS = buildTimeOptions(30);

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

function MonthBar({ yearMonth, onChange }) {
  return (
    <div className="staff-monthbar">
      <button type="button" className="staff-monthbar__btn" onClick={() => onChange(shiftYm(yearMonth, -1))} aria-label="前月">‹</button>
      <p className="staff-monthbar__label">{formatYmJa(yearMonth)}</p>
      <button type="button" className="staff-monthbar__btn" onClick={() => onChange(shiftYm(yearMonth, 1))} aria-label="翌月">›</button>
    </div>
  );
}

function StaffHome({ user, storeName, onNavigate, unread }) {
  const features = [
    { id: 'hope', title: '希望シフト', desc: '出勤・休みの希望を申請', icon: IconHope, tone: 'sky' },
    { id: 'schedule', title: '勤務状況', desc: '自分と店舗メンバーの確定シフト', icon: IconSchedule, tone: 'violet' },
    { id: 'chat', title: '店舗チャット', desc: '店長・スタッフと連絡', icon: IconBoard, tone: 'amber', badge: unread },
  ];
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
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <button key={f.id} type="button" className={`staff-feature-card staff-feature-card--${f.tone}`} onClick={() => onNavigate(f.id)}>
              <span className="staff-feature-card__icon"><Icon className="w-6 h-6" /></span>
              <span className="staff-feature-card__title">{f.title}</span>
              <span className="staff-feature-card__desc">{f.desc}</span>
              {f.badge > 0 && <span className="staff-chip staff-chip--inline staff-chip--alert">{f.badge > 99 ? '99+' : f.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StaffSchedulePanel({ token, storeId, myId, yearMonth, onYearMonth }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [filter, setFilter] = useState('all'); // all | me

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.staffGetMonth(token, storeId, yearMonth);
        if (cancelled) return;
        setEmployees(res.employees || []);
        setShifts(res.shifts || []);
      } catch (e) {
        if (cancelled) return;
        setError(e.message || String(e));
        setEmployees([]);
        setShifts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, storeId, yearMonth]);

  const myKey = empKey(myId);
  const byEmpDay = useMemo(() => {
    const map = {};
    shifts.forEach((s) => {
      const key = `${empKey(s.employee_id)}__${s.date}`;
      map[key] = s;
    });
    return map;
  }, [shifts]);

  const visibleEmps = useMemo(() => {
    const list = employees.slice();
    if (filter === 'me') {
      return list.filter((e) => empKey(e.employee_id || e.bye_code) === myKey);
    }
    return list;
  }, [employees, filter, myKey]);

  const days = daysInYm(yearMonth);
  const dayList = useMemo(() => {
    const out = [];
    for (let d = 1; d <= days; d += 1) {
      const ymd = `${yearMonth}-${String(d).padStart(2, '0')}`;
      out.push(ymd);
    }
    return out;
  }, [yearMonth, days]);

  return (
    <div className="staff-panel">
      <MonthBar yearMonth={yearMonth} onChange={onYearMonth} />
      <div className="staff-filter">
        <button type="button" className={`staff-filter__btn${filter === 'me' ? ' is-on' : ''}`} onClick={() => setFilter('me')}>自分</button>
        <button type="button" className={`staff-filter__btn${filter === 'all' ? ' is-on' : ''}`} onClick={() => setFilter('all')}>店舗全員</button>
      </div>
      {loading && <p className="staff-panel__status">読み込み中…</p>}
      {error && <p className="staff-panel__error">{error}</p>}
      {!loading && !error && visibleEmps.length === 0 && (
        <p className="staff-panel__status">表示できるスタッフがいません。</p>
      )}
      {!loading && !error && visibleEmps.map((emp) => {
        const eid = emp.employee_id || emp.bye_code;
        const isMe = empKey(eid) === myKey;
        return (
          <section key={eid} className={`staff-emp-card${isMe ? ' is-me' : ''}`}>
            <header className="staff-emp-card__head">
              <p className="staff-emp-card__name">{emp.name}{isMe ? '（自分）' : ''}</p>
            </header>
            <ul className="staff-day-list">
              {dayList.map((ymd) => {
                const shift = byEmpDay[`${empKey(eid)}__${ymd}`];
                if (!shift || !shift.status || shift.status === 'undef') {
                  if (filter === 'me') {
                    return (
                      <li key={ymd} className="staff-day-row is-empty">
                        <span className="staff-day-row__date">{formatDateJa(ymd)}</span>
                        <span className="staff-day-row__val">未定</span>
                      </li>
                    );
                  }
                  return null;
                }
                const work = shift.status === 'work';
                return (
                  <li key={ymd} className={`staff-day-row${work ? ' is-work' : ' is-off'}`}>
                    <span className="staff-day-row__date">{formatDateJa(ymd)}</span>
                    <span className="staff-day-row__val">{shiftLabel(shift)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function StaffHopePanel({ token, storeId, yearMonth, onYearMonth }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [hopes, setHopes] = useState([]);
  const [kind, setKind] = useState('work');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('18:00');
  const [memo, setMemo] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const res = await api.staffListHopes(token, storeId, yearMonth);
      setHopes(res.hopes || []);
    } catch (e) {
      setError(e.message || String(e));
      setHopes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, storeId, yearMonth]);

  useEffect(() => {
    if (!date) {
      const d = new Date();
      const ymd = `${yearMonth}-${String(Math.min(d.getDate(), daysInYm(yearMonth))).padStart(2, '0')}`;
      if (ymd.startsWith(yearMonth)) setDate(ymd);
      else setDate(`${yearMonth}-01`);
    }
  }, [yearMonth, date]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setInfo('');
    try {
      await api.staffSubmitHope({
        token,
        store_id: storeId,
        date,
        kind,
        start_time: kind === 'work' ? start : '',
        end_time: kind === 'work' ? end : '',
        memo,
      });
      setMemo('');
      setInfo('申請しました。店舗チャットにも通知されます。');
      await reload();
    } catch (ex) {
      setError(ex.message || String(ex));
    } finally {
      setSaving(false);
    }
  }

  async function cancelHope(hopeId) {
    if (!window.confirm('この申請を取り消しますか？')) return;
    setError('');
    try {
      await api.staffCancelHope({ token, store_id: storeId, hope_id: hopeId });
      await reload();
    } catch (ex) {
      setError(ex.message || String(ex));
    }
  }

  const maxDay = daysInYm(yearMonth);

  return (
    <div className="staff-panel">
      <MonthBar yearMonth={yearMonth} onChange={onYearMonth} />
      <form className="staff-hope-form" onSubmit={submit}>
        <p className="staff-section-label">新規申請</p>
        <div className="staff-hope-kind">
          <button type="button" className={`staff-filter__btn${kind === 'work' ? ' is-on' : ''}`} onClick={() => setKind('work')}>出勤希望</button>
          <button type="button" className={`staff-filter__btn${kind === 'off' ? ' is-on' : ''}`} onClick={() => setKind('off')}>休み希望</button>
        </div>
        <label className="staff-field">
          <span>日付</span>
          <input
            type="date"
            value={date}
            min={`${yearMonth}-01`}
            max={`${yearMonth}-${String(maxDay).padStart(2, '0')}`}
            onChange={(ev) => setDate(ev.target.value)}
            required
          />
        </label>
        {kind === 'work' && (
          <div className="staff-hope-times">
            <label className="staff-field">
              <span>開始</span>
              <select value={start} onChange={(ev) => setStart(ev.target.value)}>
                {TIME_OPTIONS.map((t) => <option key={`s-${t}`} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="staff-field">
              <span>終了</span>
              <select value={end} onChange={(ev) => setEnd(ev.target.value)}>
                {TIME_OPTIONS.map((t) => <option key={`e-${t}`} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        )}
        <label className="staff-field">
          <span>メモ（任意）</span>
          <input type="text" value={memo} maxLength={200} placeholder="例: 午後から可" onChange={(ev) => setMemo(ev.target.value)} />
        </label>
        {error && <p className="staff-panel__error">{error}</p>}
        {info && <p className="staff-panel__ok">{info}</p>}
        <button type="submit" className="staff-primary-btn" disabled={saving}>
          {saving ? '送信中…' : '申請する'}
        </button>
      </form>

      <p className="staff-section-label">申請一覧</p>
      {loading && <p className="staff-panel__status">読み込み中…</p>}
      {!loading && hopes.length === 0 && <p className="staff-panel__status">この月の申請はまだありません。</p>}
      <ul className="staff-hope-list">
        {hopes.map((h) => (
          <li key={h.hope_id} className="staff-hope-item">
            <div>
              <p className="staff-hope-item__date">{formatDateJa(h.date)}</p>
              <p className="staff-hope-item__body">
                {h.kind === 'off' ? '休み希望' : `出勤 ${h.start_time}–${h.end_time}`}
                {h.memo ? ` · ${h.memo}` : ''}
              </p>
              <p className="staff-hope-item__state">
                {h.status === 'pending' ? '申請中' : h.status === 'accepted' ? '反映済み' : h.status}
              </p>
            </div>
            {h.status === 'pending' && (
              <button type="button" className="staff-hope-item__cancel" onClick={() => cancelHope(h.hope_id)}>取消</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffChatTab({ chat, storeId, storeName, user }) {
  return (
    <div className="staff-chat-tab">
      <StoreChatPanel
        open
        embedded
        storeId={storeId}
        storeName={storeName}
        user={user}
        messages={chat.messages}
        loading={chat.loading}
        sending={chat.sending}
        draft={chat.draft}
        onDraft={chat.setDraft}
        onSend={() => chat.send()}
        onClose={() => {}}
        onDelete={(id) => chat.remove(id)}
      />
    </div>
  );
}

export function StaffApp({ user, storeId, storeName, onLogout }) {
  const [tab, setTab] = useState('home');
  const [yearMonth, setYearMonth] = useState(currentYm);
  const token = user?.sessionToken || localStorage.getItem(STAFF_TOKEN_KEY) || '';
  const myId = user?.employee_id || user?.bye_code || '';

  const chat = useStoreChat({
    storeId,
    user,
    enabled: !!storeId && !!token,
    sessionToken: token,
  });

  useEffect(() => {
    if (tab === 'chat') chat.setOpen(true);
    else chat.setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  let panel = (
    <StaffHome
      user={user}
      storeName={storeName}
      unread={chat.unread}
      onNavigate={setTab}
    />
  );
  if (tab === 'hope') {
    panel = (
      <StaffHopePanel
        token={token}
        storeId={storeId}
        yearMonth={yearMonth}
        onYearMonth={setYearMonth}
      />
    );
  } else if (tab === 'schedule') {
    panel = (
      <StaffSchedulePanel
        token={token}
        storeId={storeId}
        myId={myId}
        yearMonth={yearMonth}
        onYearMonth={setYearMonth}
      />
    );
  } else if (tab === 'chat') {
    panel = <StaffChatTab chat={chat} storeId={storeId} storeName={storeName} user={user} />;
  }

  return (
    <div className="staff-shell">
      <div className="staff-shell__bg" aria-hidden="true" />
      <header className="staff-header">
        <div className="staff-header__brand">
          <BrandTitle size="compact" />
          <span className="staff-header__badge">アルバイト</span>
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
            <button
              key={t.id}
              type="button"
              className={`staff-tabbar__item${on ? ' staff-tabbar__item--on' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={on ? 'page' : undefined}
            >
              <span className="staff-tabbar__icon-wrap">
                <Icon className="w-[1.35rem] h-[1.35rem]" />
                {t.id === 'chat' && chat.unread > 0 && (
                  <span className="staff-tabbar__badge">{chat.unread > 9 ? '9+' : chat.unread}</span>
                )}
              </span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
