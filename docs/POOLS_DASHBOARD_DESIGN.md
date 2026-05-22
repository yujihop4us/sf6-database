# Pools Dashboard Design Document
## Target: EVO 2026 Las Vegas (June 26-28)

### 1. Background

CB2026 (1,451 entrants, 64 pools) のライブ運用で判明した課題：
- Pools 中は start.gg の state=2 (in-progress) が一切発生しない
- TO がまとめて結果を入力するため state は 1→3 に直接遷移
- H2H 自動連動が Pools では機能しない
- 配信中のマッチと Latest Results がずれる

EVO 2026 は 4,000〜5,000 エントラント、150〜200 プールが見込まれ、
CB より複雑。Pools 専用の表示モードが必須。

### 2. Phase Structure (CB2026 実績ベース)

| Phase | CB2026 | EVO 2026 (予測) |
|-------|--------|-----------------|
| Round 1 (Pools) | 64 groups | 150-200 groups |
| Round 2 | 8 groups | 16-32 groups |
| Round 3 | 2 groups | 4-8 groups |
| Top 24/32 | 1 bracket | 1 bracket |
| Top 8 | 1 bracket | 1 bracket |

### 3. Display Mode Switching

| Mode | Trigger (自動) | 表示内容 |
|------|---------------|---------|
| Pools Dashboard | phase.name = "Round 1" or "Round 2" | 速報フィード + プール進行 + 抜け選手 |
| H2H Mode | phase.name = "Round 3" 以降 | 現行の StreamCenter + H2H |
| Manual Toggle | UI ボタン | どちらのモードにも手動切替可能 |

自動判定ロジック:
- event.sets の最新 completed セットの phaseGroup.phase.name を取得
- "Round 1" / "Round 2" → Pools Dashboard
- それ以外 → H2H Mode

### 4. Pools Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│                      NAVBAR                         │
├───────────────────────────────┬─────────────────────┤
│                               │                     │
│        Twitch Stream          │    Twitch Chat      │
│         (配信映像)             │                     │
│                               │                     │
├───────────────────────────────┼─────────────────────┤
│                               │                     │
│      ⚡ LIVE FEED              │  📊 POOL PROGRESS   │
│       (速報フィード)            │  (プール進行状況)    │
│                               │                     │
│  🔥 UPSET! #142 beat #3       │  Round 1: ████░ 80% │
│  ✅ Tokido → Top 32 (W)       │  Round 2: ░░░░░  0% │
│  ❌ PlayerX eliminated        │                     │
│  🎯 Punk vs iDom coming up    │  Pool A01: ██░  60% │
│                               │  Pool A02: ████ 100%│
│                               │  Pool A03: ███░  75%│
│                               │  ...                │
│                               │                     │
├───────────────────────────────┴─────────────────────┤
│                  🏆 QUALIFIED PLAYERS                │
│  Winners: Tokido, MenaRD, Punk, iDom, ...           │
│  Losers:  Mago, Fuudo, Kazunoko, ...                │
└─────────────────────────────────────────────────────┘
```

### 5. Live Feed (速報フィード)

#### 5.1 Event Types & Triggers

| Type | Trigger | Icon | Priority |
|------|---------|------|----------|
| UPSET | lower seed beats higher seed (seed差 >= 20 or Tier差 >= 2) | 🔥 | HIGH |
| QUALIFIED_W | fullRoundText contains "Winners Final" + completed + winner | ✅ | HIGH |
| QUALIFIED_L | fullRoundText contains "Losers Final" + completed + winner | ✅ | MEDIUM |
| ELIMINATED | fullRoundText contains "Losers" + completed + loser | ❌ | LOW (notable players only) |
| MARQUEE_UPCOMING | both entrants are S/A Tier + state=1 | 🎯 | MEDIUM |
| MARQUEE_RESULT | both entrants are S/A Tier + completed | ⚔️ | HIGH |

#### 5.2 Upset Detection Logic

```js
function isUpset(set): boolean {
  const seedDiff = Math.abs(winner.seedNum - loser.seedNum)
  const winnerSeedHigher = winner.seedNum > loser.seedNum  // Lower seed (higher number) won

  if (winnerSeedHigher && seedDiff >= 20) return true
  // Tier-based: winner Tier is lower than loser
  if (winnerTier > loserTier && tierDiff >= 2) return true
  return false
}
```

#### 5.3 Notable Player Filter

全選手の elimination を表示すると多すぎるため、
以下の選手のみ ELIMINATED イベントを生成：
- S/A Tier の選手
- シード上位 32 位以内
- このサイトの players DB に登録されている選手

#### 5.4 Toast Overlay (配信画面オーバーレイ)

- HIGH priority イベントのみ配信画面下部にトースト表示
- スライドイン → 5秒表示 → スライドアウト
- 同時に1件のみ、キューで順番に表示
- 半透明背景 + テキスト
- 手動で dismiss 可能

#### 5.5 Feed List (蓄積リスト)

- 全イベントを時系列で表示（新しいものが上）
- 最大100件保持、古いものは自動削除
- イベントタイプでフィルタ可能
- 選手名クリック → /player/[id] ページへ遷移

### 6. Pool Progress (プール進行状況)

#### 6.1 Overall Progress Bar

各 Round の全体進行率: completed sets / total sets × 100%

#### 6.2 Individual Pool Progress

- 各プールの進行率をミニプログレスバーで表示
- 完了プールはグレーアウト
- 進行中プールは緑ハイライト
- クリックで展開 → プール内の全セット結果表示

#### 6.3 Scalability for EVO (200 pools)

200プールを全て表示するとスペースが足りないため：
- デフォルトはグリッド表示（小さな色付きブロック）
  - 緑 = 完了、黄 = 進行中、灰 = 未開始
- ホバーで プール名 + 進行率をツールチップ表示
- フィルタ: "進行中のみ" / "注目選手がいるプール"
- 検索: プール番号 or 選手名で検索

### 7. Qualified Players (抜け選手一覧)

- Winners 側抜け: 緑バッジ
- Losers 側抜け: 黄バッジ
- 選手名 + シード番号 + 使用キャラアイコン
- クリック → /player/[id] ページへ遷移
- リアルタイム更新（セット完了ごとに追加）

### 8. Data Flow

```
start.gg API (60s polling)
        ↓
live-fetch-v2.js
        ↓
upsert Supabase tournament_sets
        ↓
query /api/pools-dashboard?eventId=XXX
        ↓
compute {
  feed: FeedEvent[],
  pools: PoolProgress[],
  qualified: QualifiedPlayer[],
  overallProgress: { round1: 80, round2: 0, ... },
  currentPhase: "Round 1"
}
        ↓
poll (15s) Frontend PoolsDashboard component
```

### 9. New API Route

`/api/pools-dashboard?eventId=XXX`

Response:
```json
{
  "currentPhase": "Round 1",
  "overallProgress": {
    "Round 1": { "completed": 512, "total": 640, "percent": 80 },
    "Round 2": { "completed": 0, "total": 80, "percent": 0 }
  },
  "feed": [
    {
      "type": "UPSET",
      "priority": "HIGH",
      "timestamp": 1716400000,
      "pool": "A01",
      "message": "#142 PlayerX defeated #3 Tokido 2-1",
      "players": [
        { "id": 123, "name": "PlayerX", "seed": 142 },
        { "id": 456, "name": "Tokido", "seed": 3 }
      ],
      "score": "2-1"
    }
  ],
  "qualified": [
    {
      "playerId": 456,
      "name": "Tokido",
      "seed": 3,
      "side": "winners",
      "pool": "A01",
      "character": "ken"
    }
  ],
  "pools": [
    { "id": "A01", "completed": 8, "total": 10, "phase": "Round 1" }
  ]
}
```

### 10. start.gg Data Requirements

必要なフィールド（GraphQL query に追加）:

- `set.phaseGroup.displayIdentifier` (プール番号: "A01")
- `set.phaseGroup.phase.name` (フェーズ名: "Round 1")
- `set.fullRoundText` ("Winners Quarter-Final" 等)
- `set.slots[].entrant.initialSeedNum` (シード番号)
- `set.completedAt` (完了時刻)
- `set.displayScore` ("Player1 2 - Player2 1")

確認済み (CB2026):
- phaseGroup.displayIdentifier ✅
- phase.name ✅ ("Round 1", "Round 2", etc.)
- fullRoundText ✅
- completedAt ✅
- displayScore ✅

未確認:
- initialSeedNum → CB2026 データで要確認

### 11. Implementation Phases

**Phase 1 (by 6/10): データ層**
- /api/pools-dashboard API route
- live-fetch-v2.js に phaseGroup データ保存追加
- Upset / Qualified / Eliminated 判定ロジック
- Supabase に feed_events テーブル追加

**Phase 2 (by 6/17): UI**
- PoolsDashboard コンポーネント
- LiveFeed コンポーネント (リスト + フィルタ)
- PoolProgress コンポーネント (グリッド + ツールチップ)
- QualifiedPlayers コンポーネント
- Toast overlay コンポーネント

**Phase 3 (by 6/22): 統合 & テスト**
- /live/[tournamentId] ページにモード切替統合
- CB2026 の過去データでフル回帰テスト
- EVO 2026 プレ登録データでスケーラビリティテスト

**Phase 4 (6/24-25): EVO プレ準備**
- EVO 2026 の tournamentConfig 追加
- stream channel 確認
- 負荷テスト (200 pools × 10 sets = 2000 sets)

### 12. Config Example (EVO 2026)

```javascript
'evo-2026': {
  name: 'EVO 2026',
  startggTournamentId: TBD,
  startggEventId: TBD,
  dbTournamentId: TBD,
  streamChannel: 'CapcomFighters', // 要確認
  venue: 'Las Vegas Convention Center West Hall',
  timezone: 'America/Los_Angeles',
  startDate: '2026-06-26',
  endDate: '2026-06-28',
  entrantCount: null, // 登録締切後に確定
  prizePool: null,
  cptPremier: true,
  phases: ['Round 1', 'Round 2', 'Round 3', 'Top 32', 'Top 8'],
  poolsDashboardUntil: 'Round 2', // このフェーズまで Pools Dashboard
}
```
