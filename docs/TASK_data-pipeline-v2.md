# 指示書: 大会データパイプライン v2（全大会適用・CPTポイント・Tier・Bio連携）

対象実行者: Claude Opus 5
前提ブランチ: `feat/tournament-automation`（PR #1）の続き。マージ前なら同ブランチに積む。

## 目的

大会終了後の「結果 → 賞金 → CPTポイント → 出場権 → Tier → Bio見直し」を
一連のパイプラインとして自動化し、**DB にページがある全30大会**へ適用する。

```
[stage 1] 結果同期      sets / placement           ← start.gg（無い大会は Liquipedia）
[stage 2] 賞金同期      prize_amount / total_prize ← Liquipedia 賞金表
[stage 3] ポイント同期   cpt_points（新設）          ← Liquipedia 賞金表の points 列
[stage 4] Tier昇格      players.tier               ← stage1 の placement に依存
[stage 5] Bio見直しキュー（自動書き換えはしない）      ← stage1 の placement に依存
```

**順序が本質**: stage 2〜5 はすべて placement 確定後でないと正しく動かない。
finalize-tournaments.js の1大会ループ内でこの順に実行すること。

---

## 現状の問題点（精査結果）と解決策

### P1. 最重要大会が自動化の対象外になっている ⚠最優先
`finalize-tournaments.js` は `.not('startgg_event_id','is',null)` で絞っているが、
**Capcom Cup X/11/12・EWC 2024/2025/2026 はすべて startgg_event_id が null**。
Tier・ポイントの根拠となる大会がまさに全部対象外。

**解決策**: 大会を2系統に分けて処理する。
- start.gg 系: 現行どおり `fetchStartggTruth` で検証
- Liquipedia 系（startgg_event_id が null かつ liquipedia_url あり）:
  start.gg 検証をスキップし、`sets>0`・`placements==entrants`・賞金・ポイントのみ検証。
  set の自動補完はできない（真実のソースが手編集の Liquipedia のため）。
  欠落があれば gaps として通知し、人が判断する。

### P2. 「EWC出場→B」の判定が LCQ を巻き込む ⚠データ事故リスク
`cpt_event_type='ewc'` は LCQ(id=49, 269人) にも付いている。素朴に実装すると
オープン予選の全参加者が B に昇格する。

**解決策**: cpt_event_type だけで判定しない。
Tier 対象大会は「`cpt_event_type IN ('capcom_cup','ewc')` **かつ entrants <= 64**」
（本戦は32〜48人、LCQ は269人なので確実に分離できる）。
実装時は対象大会の id 一覧をログに出し、想定（37,2,9,3,5,11 + 将来分）と一致するか
目視できるようにする。

### P3. CPTポイントの器が無い
テーブル新設が必要。ただし **DDL は Supabase ダッシュボード経由で人が実行**する運用
のため、migration SQL を書いてユーザーに実行を依頼すること（自動実行しない）。

**解決策**: `supabase/migrations/20260824_cpt_points.sql` を作成:

```sql
create table cpt_points (
  id            bigint generated always as identity primary key,
  player_id     bigint not null references players(id),
  tournament_id bigint not null references tournaments(id),
  circuit       text   not null,          -- 'cpt2024' | 'cpt2025' | 'cpt2026' | 'ewc2026' 等
  points        int    not null,
  placement     int,
  created_at    timestamptz default now(),
  unique (player_id, tournament_id, circuit)
);
```

- `circuit` は **日付から推測しない**こと。CC12(2026年3月) は CPT2025 シーズンの
  決勝であり、暦年で割ると誤る。Liquipedia infobox の `|circuit=Capcom Pro Tour 2026`
  と賞金表の `points=cpt2026` / `points=ewc2026` から取る（CEO 2026 で実在確認済み）。
- unique 制約により再実行は upsert で冪等になる。

### P4. ポイントの取得元
Liquipedia 賞金表テンプレート `{{SoloPrizePool|points=cpt2026|...}}` の各 Slot に
`|points=300` の形で入っている（CEO 2026 / EWC 2026 で実在確認済み）。
賞金と**同じ表**なので、stage 2 の賞金パーサーを拡張して place→(usd, points) を
一度に取るのが正しい。レンダリング済みHTML（prizepooltable）の行にも points 列がある。
既に EWC で実証した「レンダリング済み賞金表パーサー」を共通化して使うこと。

**過去シーズンの注意**: DB に無い過去大会（CPT2024/2025 の未収載 Premier 等）の
ポイントは大会単位では取れない。選手ページの「シーズン合計」を公式値に近づけたい
場合は、Liquipedia のシーズン順位ページ（`Capcom_Pro_Tour/2025` 等）から合計値を
取り込む案があるが、**ページ構造が未確認**なので、まず存在と構造を確認してから
착手し、無理なら「DB内大会からの集計値」表示に留めて注記を出すこと
（`※当サイト収載大会のみの集計`）。**憶測で公式合計を名乗らない**。

### P5. Tier 昇格の安全設計
現状 S:13 / A:92 は手動キュレーション済み。**自動処理は昇格のみ・降格禁止**。

ルール（ユーザー指定・確定済み）:
- 対象大会（P2 の定義）に **出場** → 現在 null または B未満なら `B`
- 対象大会で **Top 8**（placement <= 8） → 現在 B/null なら `A`
- `S` は絶対に触らない。`A` の選手が出場だけなら `A` のまま（降格しない）
- **S への自動昇格は実装しない**。S はユーザーが個別指示した場合のみ手動で変更する
  （2026-08-24 ユーザー確定）

実装: `scripts/update-player-tiers.js`（単体実行可）を作り、finalize の stage 4 で呼ぶ。
`--dry-run` で「誰が何位でどう変わるか」の全リストを出し、**初回は必ず dry-run の
結果をユーザーに見せて承認を得てから** LIVE 実行すること。100人規模で tier が
変わりうるので、無断一括更新はしない。

### P6. Bio 見直しは「キュー化」であり自動書き換えではない
対象大会の Top 3 選手の Bio を自動生成・上書きすることは**しない**（人格・経歴の
記述を無検証で自動更新するのは品質リスク）。

**解決策**: finalize の stage 5 で対象者を抽出し、
- レポート（GitHub Actions のジョブサマリ）に「Bio見直し候補」を列挙
  （選手名 / 順位 / 大会 / bio 最終更新の手掛かり / 選手ページURL）
- `gh issue create` で `bio-review` ラベルの Issue を1大会1件起票（重複起票防止のため
  タイトルで既存 Issue を検索してから）
書き換え自体はユーザー（またはユーザーが依頼した Claude セッション）が Issue を見て行う。

### P7. 全大会への適用（バックフィル）
`--all` フラグを追加（end_date 窓を外して全大会対象）。初回は
`--all --dry-run` の結果レポートをユーザーに提示してから本実行する。

既知の欠落（dry-run で必ず検出されるはず。されなければパイプラインのバグ）:
- Blink Respawn 2026 (id=43): **entrants 0件**（sets は 819件ある）
  → import-tournament.js から。slug 上書き問題（DEVLOG 既知）に注意
- EVO Japan 2025 (id=34): 賞金 0件
- Evo 2026 (id=10) / BAM16 (id=44) / EWC LCQ (id=49): 賞金 0件
- Evo 2023 (id=38): 賞金 1件のみ / Evo 2024 (id=7): 5件のみ
- EVO France 2026 (id=46): 未開催。対象から除外されることを確認

### P8. 選手名エイリアスの一元化
`NAME_MAP`（Xiaohai→Xiao Hai 等）が現在3箇所に重複している
（api/liquipedia/results, post-tournament-update.js, 各種スクリプト）。
賞金・ポイント・Tier はすべて名寄せに依存するため、ズレると静かに欠落する。
`src/lib/player-aliases.ts`（または scripts/lib/）に一本化し、全利用箇所を差し替える。
名寄せ失敗は握り潰さず、レポートの notes に「未マッチ選手名」を必ず列挙する。

### P9. 選手ページへのポイント表示（ユーザー確定: CPT と EWC を両方・別枠で表示）
- 選手ページに「サーキットポイント」セクションを追加し、**CPT と EWC を明確に
  分けて両方表示**する（2026-08-24 ユーザー確定）:
  - CPT 枠: シーズン切替（CPT2024 / CPT2025 / CPT2026）、シーズン合計、大会別内訳
    （大会名 / 順位 / ポイント）
  - EWC 枠: 年度別（EWC2024 / EWC2025 / EWC2026）、同様に合計と大会別内訳
  - 集計は `cpt_points.circuit` の接頭辞（cpt* / ewc*）でグループ分けする。
    **合算値は出さない**（別サーキットのため足しても意味を持たない）
- データが無いシーズン/年度は表示しない。ポイントが1件も無い選手には
  セクション自体を出さない
- **tier はサイトに出さない**（内部管理。既存どおり）

---

## 実装ステップ（この順で）

1. **migration SQL 作成**（P3）→ ユーザーに実行依頼 → `cpt_points` の存在確認後に先へ
2. **player-aliases 一元化**（P8）。既存挙動が変わらないことを Tokido/Booce/Xiao Hai 等で確認
3. **賞金+ポイント同期スクリプト** `scripts/sync-prizes-points.js`
   - 入力: tournament_id。Liquipedia 賞金表から place→(usd, points, circuit) を取得
   - placement と突き合わせて `tournament_entrants.prize_amount` と `cpt_points` を upsert
   - タイ順位（5-8 等のレンジ行）対応は EWC 実装を踏襲
   - 検証: CEO 2026 / EWC 2026 / CC12 で既知の値と一致すること
     （例: CEO 1位 Tokido $7,525 + 0pts ではなく points 列の実値。CC12 は 48人分）
4. **Tier スクリプト** `scripts/update-player-tiers.js`（P5。dry-run 承認フロー厳守）
5. **finalize-tournaments.js 拡張**
   - Liquipedia 系大会の処理系統を追加（P1）
   - stage 2〜5 を組み込み（順序厳守）
   - `--all` 追加（P7）
   - レポート列に「ポイント」「Tier変更数」「Bio候補数」を追加
6. **選手ページ UI**（P9）。ビルド・実機表示・ダーク/モバイル確認
7. **全大会バックフィル**: `--all --dry-run` → ユーザー確認 → 本実行 → レポート提示
8. **DEVLOG 記録・コミット・PR #1 に積む**（コミットはファイル明示指定。
   スクラッチの check-*.js 等は含めない）

## 検証基準（Definition of Done）

- `--all --dry-run` で30大会が「✅ / ⚠(理由)」いずれかに分類され、⚠が P7 の既知欠落と一致
- 本実行後: 全 CC/EWC 本戦大会で prize件 == placement のある entrant 数
- `cpt_points` に CC/EWC/Premier 大会分が入り、CEO 2026 の 2位 Booce = 300pts など
  Liquipedia 記載値と一致
- Tier: dry-run リストをユーザー承認後に適用。S の 13人が1人も変わっていないこと
- Bio Issue が対象大会ぶん起票され、重複起票が無いこと
- 選手ページ（Tokido 等）でシーズン別ポイントが表示される
- GitHub Actions（日次）が新パイプライン込みで green

## 落とし穴メモ（過去にこのリポジトリで実際に起きたもの）

- Supabase は 1000 行で**静かに**切れる → 全取得はページネーション必須
- Liquipedia は生HTML直取得で 403 → 必ず `fetchLiquipediaHtml`（API経由）を使う。
  レート 1req/2s 厳守。429 を繰り返すと恒久 ban の警告あり
- `import-tournament.js` は slug を argv で上書きする / 既存行の placement を更新しない
- start.gg `phaseGroups` はページネーション必須（perPage:100 + pageInfo 警告実装済み）
- 「エラーが出ない＝成功」ではない。件数検証を必ず入れ、差分は notes/gaps に出す
