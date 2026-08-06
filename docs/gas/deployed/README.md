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

## GAS への反映（clasp）

コピペ不要。このフォルダから push → デプロイできます。

```powershell
# リポジトリ直下
npm run build:gas
cd docs\gas\deployed
clasp push --force
clasp deploy -i AKfycbxp0HBE4-akd-bbMFzvkaAbFiBkxlK-m8W7HugP9nkYx0LEs8kwu1sjdo54AABZuijv -d "update"
```

scriptId: `15loL8q7-ODEgzBIhGS2Xa4w_FbDvU1_xf3_grVLiv9JoxB8hNdhAEikI`

## 旧: 手貼り付け

1. スプシ → 拡張機能 → Apps Script  
2. `Code.gs` を **全部差し替え**（重要）  
3. `index` HTML をビルドした `index.html` で **全部差し替え**  
4. スプレッドシートでメニュー **シフト基盤 → シート構成を初期セットアップ**（または「週間固定」シートを追加）  
5. デプロイ → 管理 → 編集  
   - **実行ユーザー: 自分**  
   - **アクセス: 組織内の全員**  
6. **新しいバージョン** でデプロイ → `/exec` を開き直す  

## アプリ導線

1. ログイン（会社メール）  
2. 管轄店舗登録（エリア・店舗。同じ管轄の人は同じ店舗データを共有）  
3. 従業員登録（フルネーム・社員コード）  
4. 週間スケジュール（固定出勤）  
5. 月間シフト作成（グリッド表示・セル編集）

## ログイン

ToDo List と同じく **会社メール入力** です。
