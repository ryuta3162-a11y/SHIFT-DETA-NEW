import { useEffect, useMemo, useState } from 'react';
import { BrandTitle } from './BrandTitle.jsx';
import { api } from './api.js';
import { StoreChatPanel, useStoreChat } from './StoreChat.jsx';
import { STAFF_TOKEN_KEY } from './staffAuth.js';

const TABS = [
  { id: 'home', label: 'ホーム', icon: IconHome },
  { id: 'schedule', label: '勤務', icon: IconSchedule },
  { id: 'hope', label: '希望', icon: IconHope },
  { id: 'chat', label: 'チャット', icon: IconBoard },
];

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];
const STATUS_LABEL = { work: '出勤', off: '休み', pto: '有休', absent: '欠勤', undef: '未定' };

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftYm(ym, delta) {
  const [y, m] = String(ym || currentYm()).split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function formatYmJa(ym) {
  const [y, m] = String(ym || '').split('-');
  if (!y || !m) return ym;
  return `${Number(m)}月`;
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
  if (!shift) return '未定';
  const st = String(shift.status || '');
  if (st === 'work' && shift.start_time && shift.end_time) {
    return `${shift.start_time}–${shift.end_time}`;
  }
  return STATUS_LABEL[st] || '未定';
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
    <div className="sp-monthbar">
      <button type="button" className="sp-monthbar__btn" onClick={() => onChange(shiftYm(yearMonth, -1))} aria-label="前月">‹</button>
      <p className="sp-monthbar__label">{formatYmJa(yearMonth)}</p>
      <button type="button" className="sp-monthbar__btn" onClick={() => onChange(shiftYm(yearMonth, 1))} aria-label="翌月">›</button>
    </div>
  );
}

function StaffHome({ user, storeName, onNavigate, unread }) {
  const features = [
    { id: 'schedule', title: '勤務', desc: 'みんなの出勤時間を見る', icon: IconSchedule, tone: 'blue' },
    { id: 'hope', title: '希望', desc: '出勤・休みを申請する', icon: IconHope, tone: 'teal' },
    { id: 'chat', title: 'チャット', desc: '店舗の連絡', icon: IconBoard, tone: 'slate', badge: unread },
  ];
  return (
    <div className="sp-home">
      <section className="sp-home__head">
        <p className="sp-home__name">{user?.name}</p>
        <p className="sp-home__store">{storeName || '所属店舗'}</p>
      </section>
      <div className="sp-home__grid">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <button key={f.id} type="button" className={`sp-navcard sp-navcard--${f.tone}`} onClick={() => onNavigate(f.id)}>
              <span className="sp-navcard__icon"><Icon className="w-6 h-6" /></span>
              <span className="sp-navcard__title">{f.title}</span>
              <span className="sp-navcard__desc">{f.desc}</span>
              {f.badge > 0 && <span className="sp-navcard__badge">{f.badge > 99 ? '99+' : f.badge}</span>}
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
  const [selectedDay, setSelectedDay] = useState(() => {
    const t = todayYmd();
    return t.startsWith(yearMonth) ? t : `${yearMonth}-01`;
  });
  const [mode, setMode] = useState('day'); // day | me

  useEffect(() => {
    const t = todayYmd();
    setSelectedDay(t.startsWith(yearMonth) ? t : `${yearMonth}-01`);
  }, [yearMonth]);

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
      map[`${empKey(s.employee_id)}__${s.date}`] = s;
    });
    return map;
  }, [shifts]);

  const dayList = useMemo(() => {
    const days = daysInYm(yearMonth);
    const out = [];
    for (let d = 1; d <= days; d += 1) {
      out.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
    }
    return out;
  }, [yearMonth]);

  const dayBoard = useMemo(() => {
    const rows = employees.map((emp) => {
      const eid = emp.employee_id || emp.bye_code;
      const shift = byEmpDay[`${empKey(eid)}__${selectedDay}`];
      return { emp, eid, shift, isMe: empKey(eid) === myKey };
    });
    const rank = (row) => {
      const st = row.shift?.status;
      if (st === 'work') return 0;
      if (st === 'off' || st === 'pto' || st === 'absent') return 1;
      return 2;
    };
    return rows.sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d) return d;
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      return String(a.emp.name || '').localeCompare(String(b.emp.name || ''), 'ja');
    });
  }, [employees, byEmpDay, selectedDay, myKey]);

  const myMonthRows = useMemo(() => {
    return dayList.map((ymd) => ({
      ymd,
      shift: byEmpDay[`${myKey}__${ymd}`],
    }));
  }, [dayList, byEmpDay, myKey]);

  const workCount = dayBoard.filter((r) => r.shift?.status === 'work').length;

  return (
    <div className="sp-panel">
      <div className="sp-toolbar">
        <MonthBar yearMonth={yearMonth} onChange={onYearMonth} />
        <div className="sp-seg">
          <button type="button" className={`sp-seg__btn${mode === 'day' ? ' is-on' : ''}`} onClick={() => setMode('day')}>みんな</button>
          <button type="button" className={`sp-seg__btn${mode === 'me' ? ' is-on' : ''}`} onClick={() => setMode('me')}>自分</button>
        </div>
      </div>

      {mode === 'day' && (
        <>
          <div className="sp-daystrip" role="listbox" aria-label="日付">
            {dayList.map((ymd) => {
              const dayNum = Number(ymd.slice(8));
              const wd = new Date(`${ymd}T00:00:00`).getDay();
              const on = ymd === selectedDay;
              const hasWork = employees.some((emp) => {
                const s = byEmpDay[`${empKey(emp.employee_id || emp.bye_code)}__${ymd}`];
                return s?.status === 'work';
              });
              return (
                <button
                  key={ymd}
                  type="button"
                  className={`sp-daychip${on ? ' is-on' : ''}${wd === 0 ? ' is-sun' : ''}${wd === 6 ? ' is-sat' : ''}`}
                  onClick={() => setSelectedDay(ymd)}
                >
                  <span className="sp-daychip__wd">{WEEKDAY[wd]}</span>
                  <span className="sp-daychip__n">{dayNum}</span>
                  {hasWork && <span className="sp-daychip__dot" />}
                </button>
              );
            })}
          </div>
          <div className="sp-dayhead">
            <p className="sp-dayhead__date">{formatDateJa(selectedDay)}</p>
            <p className="sp-dayhead__meta">出勤 {workCount}人</p>
          </div>
        </>
      )}

      {loading && <p className="sp-status">読み込み中…</p>}
      {error && <p className="sp-error">{error}</p>}

      {!loading && !error && mode === 'day' && (
        <ul className="sp-people">
          {dayBoard.map(({ emp, eid, shift, isMe }) => {
            const st = shift?.status || '';
            const work = st === 'work';
            return (
              <li key={eid} className={`sp-person${isMe ? ' is-me' : ''}${work ? ' is-work' : ''}`}>
                <div className="sp-person__left">
                  <span className="sp-person__avatar">{String(emp.name || '?').replace(/\s/g, '').slice(0, 1)}</span>
                  <div>
                    <p className="sp-person__name">{emp.name}{isMe ? ' · 自分' : ''}</p>
                    <p className="sp-person__sub">{STATUS_LABEL[st] || '未定'}</p>
                  </div>
                </div>
                <p className={`sp-person__time${work ? ' is-work' : ''}`}>{shiftLabel(shift)}</p>
              </li>
            );
          })}
          {dayBoard.length === 0 && <li className="sp-status">スタッフがいません</li>}
        </ul>
      )}

      {!loading && !error && mode === 'me' && (
        <ul className="sp-mylist">
          {myMonthRows.map(({ ymd, shift }) => {
            const st = shift?.status || '';
            if (!st || st === 'undef') return null;
            return (
              <li key={ymd} className={`sp-myrow${st === 'work' ? ' is-work' : ''}`}>
                <span>{formatDateJa(ymd)}</span>
                <strong>{shiftLabel(shift)}</strong>
              </li>
            );
          })}
        </ul>
      )}
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
    const t = todayYmd();
    setDate(t.startsWith(yearMonth) ? t : `${yearMonth}-01`);
  }, [yearMonth]);

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
      setInfo('申請しました');
      await reload();
    } catch (ex) {
      setError(ex.message || String(ex));
    } finally {
      setSaving(false);
    }
  }

  async function cancelHope(hopeId) {
    if (!window.confirm('この申請を取り消しますか？')) return;
    try {
      await api.staffCancelHope({ token, store_id: storeId, hope_id: hopeId });
      await reload();
    } catch (ex) {
      setError(ex.message || String(ex));
    }
  }

  const maxDay = daysInYm(yearMonth);

  return (
    <div className="sp-panel">
      <MonthBar yearMonth={yearMonth} onChange={onYearMonth} />
      <form className="sp-hope" onSubmit={submit}>
        <div className="sp-seg">
          <button type="button" className={`sp-seg__btn${kind === 'work' ? ' is-on' : ''}`} onClick={() => setKind('work')}>出勤</button>
          <button type="button" className={`sp-seg__btn${kind === 'off' ? ' is-on' : ''}`} onClick={() => setKind('off')}>休み</button>
        </div>
        <label className="sp-field">
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
          <div className="sp-hope__times">
            <label className="sp-field">
              <span>開始</span>
              <select value={start} onChange={(ev) => setStart(ev.target.value)}>
                {TIME_OPTIONS.map((t) => <option key={`s-${t}`} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="sp-field">
              <span>終了</span>
              <select value={end} onChange={(ev) => setEnd(ev.target.value)}>
                {TIME_OPTIONS.map((t) => <option key={`e-${t}`} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        )}
        <label className="sp-field">
          <span>メモ</span>
          <input type="text" value={memo} maxLength={200} placeholder="任意" onChange={(ev) => setMemo(ev.target.value)} />
        </label>
        {error && <p className="sp-error">{error}</p>}
        {info && <p className="sp-ok">{info}</p>}
        <button type="submit" className="sp-submit" disabled={saving}>{saving ? '送信中…' : '申請する'}</button>
      </form>

      <p className="sp-label">申請一覧</p>
      {loading && <p className="sp-status">読み込み中…</p>}
      {!loading && hopes.length === 0 && <p className="sp-status">まだありません</p>}
      <ul className="sp-hope-list">
        {hopes.map((h) => (
          <li key={h.hope_id} className="sp-hope-item">
            <div>
              <p className="sp-hope-item__date">{formatDateJa(h.date)}</p>
              <p className="sp-hope-item__body">
                {h.kind === 'off' ? '休み' : `${h.start_time}–${h.end_time}`}
                {h.memo ? ` / ${h.memo}` : ''}
              </p>
            </div>
            {h.status === 'pending' && (
              <button type="button" className="sp-hope-item__cancel" onClick={() => cancelHope(h.hope_id)}>取消</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffChatTab({ chat, storeId, storeName, user }) {
  return (
    <div className="sp-chat">
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
    <StaffHome user={user} storeName={storeName} unread={chat.unread} onNavigate={setTab} />
  );
  if (tab === 'hope') {
    panel = <StaffHopePanel token={token} storeId={storeId} yearMonth={yearMonth} onYearMonth={setYearMonth} />;
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
    <div className={`staff-shell${tab === 'chat' ? ' is-chat' : ''}`}>
      <div className="staff-shell__bg" aria-hidden="true" />
      <header className="staff-header">
        <div className="staff-header__brand">
          <BrandTitle size="compact" />
        </div>
        <button type="button" className="staff-header__logout" onClick={onLogout} aria-label="ログアウト">
          <IconLogout />
        </button>
      </header>
      <main className={`staff-main${tab === 'chat' ? ' is-chat' : ''}`}>{panel}</main>
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
