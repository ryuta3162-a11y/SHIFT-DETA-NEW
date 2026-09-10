/** 店舗チャット（右下FAB・セルリンク付き） */
import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const AVATAR_COLORS = [
  '#2f7ec4', '#3d6b8a', '#5b7c99', '#1f6f8b', '#4a6fa5',
  '#2c5f7a', '#3a7ca5', '#2563a8', '#395b7a', '#2e6b8a',
];

function hashHue(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initialOf(name) {
  const t = String(name || '').trim();
  if (!t) return '?';
  const ch = t.replace(/[\s　]+/g, '')[0];
  return ch || '?';
}

function formatChatTime(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return s.slice(0, 16);
  const day = s.slice(5, 10).replace('-', '/');
  return `${day} ${m[1]}:${m[2]}`;
}

export function StoreChatFab({ open, unread, onToggle }) {
  return (
    <button
      type="button"
      className={`store-chat-fab ${open ? 'is-open' : ''}`}
      onClick={onToggle}
      aria-label={open ? 'チャットを閉じる' : 'チャットを開く'}
      title="店舗チャット"
    >
      {open ? (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
          <path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v9A2.5 2.5 0 0117.5 17H9.2L5.4 20.1c-.7.55-1.7.05-1.7-.8V5.5z" />
        </svg>
      )}
      {!open && unread > 0 && (
        <span className="store-chat-fab-badge">{unread > 99 ? '99+' : unread}</span>
      )}
    </button>
  );
}

export function StoreChatPanel({
  open,
  storeId,
  storeName,
  user,
  messages,
  loading,
  sending,
  draft,
  onDraft,
  onSend,
  onClose,
  onOpenLink,
}) {
  const listRef = useRef(null);
  const me = String(user?.email || '').toLowerCase();

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages.length, loading]);

  if (!open) return null;

  return (
    <div className="store-chat-panel" role="dialog" aria-label="店舗チャット">
      <div className="store-chat-head">
        <div className="min-w-0">
          <p className="store-chat-kicker">店舗チャット</p>
          <p className="store-chat-title truncate">{storeName || '店舗'}</p>
        </div>
        <button type="button" className="store-chat-close" onClick={onClose}>閉じる</button>
      </div>

      <div className="store-chat-list" ref={listRef}>
        {loading && messages.length === 0 && (
          <p className="store-chat-empty">読み込み中…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="store-chat-empty">まだメッセージがありません。<br />「この日を休みにしました」などを共有できます。</p>
        )}
        {messages.map((m) => {
          const mine = String(m.user_email || '').toLowerCase() === me;
          const name = m.user_name || m.user_email || '不明';
          const color = hashHue(m.user_email || name);
          const hasLink = !!(m.link_employee_id && m.link_date);
          return (
            <div key={m.message_id} className={`store-chat-row ${mine ? 'is-mine' : ''}`}>
              {!mine && (
                <span className="store-chat-avatar" style={{ background: color }} title={name}>
                  {initialOf(name)}
                </span>
              )}
              <div className="store-chat-bubble">
                <div className="store-chat-meta">
                  <span className="store-chat-name">{mine ? '自分' : name}</span>
                  <span className="store-chat-time">{formatChatTime(m.created_at)}</span>
                </div>
                <p className="store-chat-body">{m.body}</p>
                {hasLink && (
                  <button
                    type="button"
                    className="store-chat-link"
                    onClick={() => onOpenLink?.(m)}
                  >
                    {m.link_label || 'シフトを開く'}
                  </button>
                )}
              </div>
              {mine && (
                <span className="store-chat-avatar is-mine" style={{ background: color }} title={name}>
                  {initialOf(name)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <form
        className="store-chat-compose"
        onSubmit={(ev) => {
          ev.preventDefault();
          onSend?.();
        }}
      >
        <input
          type="text"
          className="store-chat-input"
          value={draft}
          onChange={(ev) => onDraft?.(ev.target.value)}
          placeholder="メッセージを入力…"
          maxLength={500}
          disabled={sending || !storeId}
        />
        <button type="submit" className="store-chat-send" disabled={sending || !String(draft || '').trim()}>
          送信
        </button>
      </form>
    </div>
  );
}

/** セル内容から共有文を作る */
export function buildCellSharePayload(emp, date, shift, leaveLabelFn, dateLabelFn) {
  const name = emp?.name || 'スタッフ';
  const dLabel = dateLabelFn?.(date) || String(date || '');
  const status = String(shift?.status || '');
  const lc = Number(shift?.leave_code) || 0;
  const leaveName = lc ? (leaveLabelFn?.(lc) || '') : '';
  let label = `${name} ${dLabel}`;
  let body = '';
  if (leaveName) {
    body = `${name} ${dLabel} を${leaveName}にしました`;
    label = `${name} · ${leaveName}`;
  } else if (status === 'off') {
    body = `${name} ${dLabel} を休みにしました`;
    label = `${name} · 休み`;
  } else if (status === 'pto') {
    body = `${name} ${dLabel} を有休にしました`;
    label = `${name} · 有休`;
  } else if (status === 'absent') {
    body = `${name} ${dLabel} を欠勤にしました`;
    label = `${name} · 欠勤`;
  } else if (status === 'work' && shift?.start_time && shift?.end_time) {
    body = `${name} ${dLabel} を ${shift.start_time}-${shift.end_time} にしました`;
    label = `${name} · ${shift.start_time}-${shift.end_time}`;
  } else {
    body = `${name} ${dLabel} のシフトについて`;
  }
  return {
    body,
    link_employee_id: emp?.employee_id || '',
    link_date: date || '',
    link_label: label,
  };
}

export function useStoreChat({ storeId, user, enabled }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastSeenRef = useRef('');
  const openRef = useRef(false);
  openRef.current = open;

  const load = async ({ quiet } = {}) => {
    if (!enabled || !storeId || !user?.email) return;
    if (!quiet) setLoading(true);
    try {
      const res = await api.listStoreChat(storeId, user.email, 80);
      const list = res.messages || [];
      setMessages(list);
      const lastId = list.length ? list[list.length - 1].message_id : '';
      if (openRef.current) {
        lastSeenRef.current = lastId;
        setUnread(0);
      } else if (lastId && lastSeenRef.current && lastId !== lastSeenRef.current) {
        const seenIdx = list.findIndex((m) => m.message_id === lastSeenRef.current);
        setUnread(seenIdx >= 0 ? list.length - 1 - seenIdx : Math.min(list.length, 9));
      } else if (!lastSeenRef.current && lastId) {
        lastSeenRef.current = lastId;
      }
    } catch {
      /* 初回シート未作成などは無視 */
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    setUnread(0);
    lastSeenRef.current = '';
    if (enabled && storeId) load({ quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, enabled, user?.email]);

  useEffect(() => {
    if (!enabled || !storeId) return undefined;
    const id = window.setInterval(() => {
      load({ quiet: true });
    }, open ? 12000 : 45000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, enabled, open, user?.email]);

  useEffect(() => {
    if (open) {
      load({ quiet: messages.length > 0 });
      if (messages.length) {
        lastSeenRef.current = messages[messages.length - 1].message_id;
        setUnread(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async (extra = {}) => {
    const body = String(extra.body != null ? extra.body : draft).trim();
    if (!body || !storeId || !user?.email || sending) return null;
    setSending(true);
    try {
      const res = await api.postStoreChat({
        user_email: user.email,
        user_name: user.name || '',
        store_id: storeId,
        body,
        link_employee_id: extra.link_employee_id || '',
        link_date: extra.link_date || '',
        link_label: extra.link_label || '',
      });
      if (res.message) {
        setMessages((prev) => [...prev.filter((m) => m.message_id !== res.message.message_id), res.message]);
        lastSeenRef.current = res.message.message_id;
        setUnread(0);
      } else {
        await load({ quiet: true });
      }
      if (extra.body == null) setDraft('');
      setOpen(true);
      return res.message || null;
    } finally {
      setSending(false);
    }
  };

  return {
    open,
    setOpen,
    messages,
    draft,
    setDraft,
    loading,
    sending,
    unread,
    load,
    send,
  };
}
