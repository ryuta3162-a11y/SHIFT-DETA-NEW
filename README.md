# SHIFT-DETA-NEW

全店シフトの一元管理プロジェクト。

- **表（データ）**: Googleスプレッドシート（DXチームのみ）
- **表（画面）**: Webアプリ1URL（店舗ごとに絞り込み）
- **処理**: GAS（カレンダー同期・勤怠出力など）

## 対象スプシ

[新 シフト『キンタイ・カレンダー』管理](https://docs.google.com/spreadsheets/d/1mPb5xUeoDoT5--yEXqUw5bY0PBpQ2AWSo17zkWML4ww/edit)

## ドキュメント

- [シート構成たたき台](docs/シート構成.md)
- [シートヘッダコピペ用](docs/シートヘッダ_コピペ用.md)
- [GASセットアップ（コピペ用）](docs/gas/README.md) ← スプシを自動で整える
- [Webアプリ骨格（貼り付け・デプロイ）](docs/gas/app/README.md) ← 次はここ

## 参考（他リポジトリ・編集しない）

- `taskmaster-pro` … TODOリスト型の Web＋GAS
- `DXteam-task/gas-kyodo` … 勤怠貼付・カレンダー同期の既存実装
