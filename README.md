# SHIFT-DETA-NEW

全店シフト一元管理（ToDo List と同じ **Web＋GAS** / **Node で大きな index をビルド**）。

## 対象スプシ

[新 シフト『キンタイ・カレンダー』管理](https://docs.google.com/spreadsheets/d/1mPb5xUeoDoT5--yEXqUw5bY0PBpQ2AWSo17zkWML4ww/edit)

## 開発〜GAS反映（ToDo List と同じ流れ）

```powershell
npm install
npm run build:gas
```

成果物:

- `docs/gas/deployed/index.html` … GAS の `index` に貼る  
- `docs/gas/deployed/Code.gs` … GAS の `Code` に貼る  

手順詳細: [docs/gas/deployed/README.md](docs/gas/deployed/README.md)

社用PCに Node が無いとき: GitHub Actions **Build GAS index**。

## ドキュメント

- [シート構成](docs/シート構成.md)
- [シート初期セットアップ GAS](docs/gas/README.md)
- [レイアウト更新専用 GAS（データ保持）](docs/gas/LayoutUpdate_README.md)
- [デプロイ手順](docs/gas/deployed/README.md)

## 参考（編集しない）

- `taskmaster-pro` … TODOリストの型
- `DXteam-task/gas-kyodo` … カレンダー／勤怠の既存実装
