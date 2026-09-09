import fs from 'fs';

const p = 'src/App.jsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/^\s*localStorage\.removeItem\(STAFF_CODE_KEY\);\n/gm, '');

const startMarker = "  if (authStep === 'login' && staffAppMode)";
const endMarker = '  return (\n    <div className="h-[100dvh] bg-white relative flex flex-col overflow-hidden">';
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker);
if (start < 0 || end < 0) {
  console.error('markers', start, end);
  process.exit(1);
}

const insert = `  if (authStep === 'login') {
    return (
      <div className="login-hero relative">
        <div className="login-hero-bg" aria-hidden="true">
          <LoginBgDecor />
        </div>
        {busy && (
          <div className="fixed inset-0 z-[100] bg-[#000b2b]/75 backdrop-blur-sm flex items-center justify-center p-6">
            <LoginLoadingPanel message={busyText || '処理中…'} />
          </div>
        )}

        <div className="login-hero-inner">
          <LoginHeroCopy tagline={APP_TAGLINE} />

          <div className="w-full max-w-[24rem]">
            <div className="login-card-float login-card-float--scroll">
              <div className="login-mode-tabs mb-3">
                <button
                  type="button"
                  className={\`login-mode-tab \${managerAuthMode === 'login' ? 'login-mode-tab--on' : ''}\`}
                  onClick={() => { setManagerAuthMode('login'); setLoginError(''); }}
                >
                  ログイン
                </button>
                <button
                  type="button"
                  className={\`login-mode-tab \${managerAuthMode === 'register' ? 'login-mode-tab--on' : ''}\`}
                  onClick={() => { setManagerAuthMode('register'); setLoginError(''); }}
                >
                  登録
                </button>
              </div>
              <h2 className="login-card-title">{managerAuthMode === 'register' ? '登録' : 'ログイン'}</h2>
              {managerAuthMode === 'register' ? (
                <form className="space-y-3.5 mt-5" onSubmit={(e) => { e.preventDefault(); registerManager(); }}>
                  <div>
                    <label className="login-form-label" htmlFor="login-email">メールアドレス</label>
                    <input id="login-email" type="email" required autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder={\`name@\${domain}\`} className="login-form-input" />
                  </div>
                  <div>
                    <label className="login-form-label" htmlFor="login-name">表示名</label>
                    <input id="login-name" type="text" autoComplete="name" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} placeholder="日下 竜汰" className="login-form-input" />
                  </div>
                  <div>
                    <label className="login-form-label" htmlFor="login-code">社員番号</label>
                    <input id="login-code" type="text" inputMode="numeric" required autoComplete="off" spellCheck={false} value={regByeCode} onChange={(e) => setRegByeCode(e.target.value)} placeholder="304642" className="login-form-input" />
                  </div>
                  {(meta?.areas || []).length > 0 && (
                    <div>
                      <label className="login-form-label" htmlFor="login-area">エリア</label>
                      <select id="login-area" className="login-form-input" value={regArea} onChange={(e) => { setRegArea(e.target.value); setRegTerritory(''); }}>
                        <option value="">すべて</option>
                        {(meta.areas || []).map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  )}
                  {(() => {
                    const catalog = meta?.allStores || [];
                    const territories = [...new Set(catalog.filter((s) => !regArea || s.area === regArea).map((s) => String(s.territory || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
                    if (!territories.length) return null;
                    return (
                      <div>
                        <label className="login-form-label" htmlFor="login-territory">テリトリー</label>
                        <select id="login-territory" className="login-form-input" value={regTerritory} onChange={(e) => setRegTerritory(e.target.value)}>
                          <option value="">すべて</option>
                          {territories.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    );
                  })()}
                  <div>
                    <p className="login-form-label">管轄店舗</p>
                    <div className="flex flex-wrap gap-2 mt-1.5 max-h-40 overflow-y-auto">
                      {(meta?.allStores || [{ store_id: 'S001', store_name: '経堂', area: '第7エリア' }, { store_id: 'S002', store_name: 'ひばりが丘', area: '第7エリア' }])
                        .filter((s) => (!regArea || s.area === regArea) && (!regTerritory || s.territory === regTerritory))
                        .map((s) => {
                          const on = regStores.includes(s.store_id);
                          return (
                            <button key={s.store_id} type="button" onClick={() => setRegStores((prev) => (prev.includes(s.store_id) ? prev.filter((x) => x !== s.store_id) : [...prev, s.store_id]))} className={\`px-3.5 py-2 rounded-xl text-[14px] font-bold border \${on ? 'bg-[#039be5] text-white border-[#039be5]' : 'bg-white text-slate-700 border-slate-200'}\`}>
                              {s.store_name}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                  {loginError && <p className="text-rose-600 text-sm font-semibold leading-relaxed whitespace-pre-wrap">{loginError}</p>}
                  <button type="submit" disabled={busy} className="login-submit"><span>登録する</span><IconLoginArrow /></button>
                </form>
              ) : (
                <form className="space-y-4 mt-5" onSubmit={(e) => { e.preventDefault(); login(loginEmail); }}>
                  <div>
                    <label className="login-form-label" htmlFor="login-email-only">メールアドレス</label>
                    <input id="login-email-only" type="email" required autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder={\`name@\${domain}\`} className="login-form-input" />
                  </div>
                  {loginError && <p className="text-rose-600 text-sm font-semibold leading-relaxed whitespace-pre-wrap">{loginError}</p>}
                  <button type="submit" disabled={busy} className="login-submit"><span>ログイン</span><IconLoginArrow /></button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

`;

fs.writeFileSync(p, s.slice(0, start) + insert + s.slice(end));
console.log('updated', p);
