# GAS に入れるファイル（ToDo List と同じ運用）

対象スプシ: [新 シフト『キンタイ・カレンダー』管理](https://docs.google.com/spreadsheets/d/1mPb5xUeoDoT5--yEXqUw5bY0PBpQ2AWSo17zkWML4ww/edit)

| GAS上の名前 | このフォルダ |
|-------------|--------------|
| `Code` / `コード` | [`Code.gs`](./Code.gs) |
| `index`（HTML） | [`index.html`](./index.html) ※ビルド成果物 |
| `SetupSheets`（任意・既存） | `docs/gas/SetupSheets.gs` |

## index.html の作り方（ToDo と同じ）

### A. 社用PCで Node が使える場合

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-gas.ps1
```

または:

```powershell
npm install
npm run build:gas
```

### B. Node が使えない場合

1. GitHub に push  
2. Actions → **Build GAS index** → Run workflow  
3. Artifacts の `gas-index-html` から `index.html` をダウンロード  

## GAS への貼り付け

1. スプシ → 拡張機能 → Apps Script  
2. `Code.gs` を **全部差し替え**（重要: 古い「ログインメール取得」版のままだと今のエラーが続く）  
3. `index` HTML をビルドした `index.html` で **全部差し替え**  
4. デプロイ → 管理 → 編集  
   - **実行ユーザー: 自分**  
   - **アクセス: 組織内の全員**  
5. **新しいバージョン** でデプロイ → `/exec` を開き直す  

## ログイン

ToDo List と同じく **会社メール入力** です。  
「権限」シートに自分のメール（admin）があること。
