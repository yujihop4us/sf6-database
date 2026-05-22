# Git Workflow Rules

## コミット頻度
- 機能単位で必ずコミット（1機能 = 1コミット）
- 2時間以上作業したら途中でもWIPコミット
- デプロイ前に必ずコミット

## タグ
- 大会前: v0.X.0-{tournament}-pre
- 大会中の安定版: v0.X.0-{tournament}-day{N}
- 大会後: v0.X.0-{tournament}-final

## ブランチ
- main: 安定版
- feat/*: 新機能開発
- fix/*: バグ修正

## ログ
- live-fetch-v2.js: nohup で /tmp/ にログ出力
- ログは大会後に logs/ にコピーして保存
- デプロイログ: docs/DEPLOY_LOG.md に日時と内容を記録

## 戻し方
- git revert（コミット単位で戻す）
- git checkout v0.X.0-tag（タグ時点に戻す）
