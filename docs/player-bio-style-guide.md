# SF6 Database — Player Bio Style Guide & Rules
# プレイヤーBio スタイルガイド & ルール

> Version: 1.2
> Created: 2026-03-17
> Last Updated: 2026-03-18

---

## 1. Bio Overview / 概要

Each player in the database has two bio fields:
- `bio` — Japanese language biography
- `bio_en` — English language biography

These are NOT direct translations. Each is written to feel natural in its language,
with cultural context appropriate for the target audience.
- Japanese: FGC日本コミュニティに馴染む文体・ニュアンスで執筆
- English: Global/Western FGC audience向けに響く文体で執筆

Both versions should cover the same core facts, but tone, emphasis,
and supplementary context may differ.

---

## 2. Required Fields / 必須項目

Every bio MUST include the following when available:

| Field | Example | Notes |
|-------|---------|-------|
| Real name (本名) | Hajime Taniguchi | Romanized + kanji if Japanese |
| Handle / Tag | Tokido | Primary competitive handle |
| Birth date & age | Feb 22, 1985 (age 41) | Omit if unverifiable; use "approx." if estimated |
| Nationality / Region | Japan (Okinawa → Tokyo) | Include hometown/origin if notable |
| Current team | REJECT | Organization name |
| SF6 main character(s) | Ken, Akuma | Primary + secondary |
| SFL participation | SFL JP 2025 — REJECT (with Fuudo, Leshar, Daigo) | Season, team, teammates |

---

## 3. Recommended Fields / 推奨項目 (include when available)

- **Career origin story**: How they got into fighting games, early arcade days, etc.
- **Major titles & achievements**: EVO wins, Capcom Cup, EWC, SBO, etc. with years
- **Character history**: Evolution of character choices across SF generations
- **Epithet / Nickname**: "Murder Face", "2D God", "The Prodigy" — and origin if known
- **Handle origin**: Why they chose their tag (e.g., Tokido = "闘気道")
- **Playstyle description**: Aggressive, calculated, execution-heavy, etc.
- **Memorable episodes**: Iconic matches, crowd moments, rivalries
- **Memes & community culture**: Things the FGC community associates with them
- **Personal tidbits**: Day job, education, family (only if publicly known & relevant)
- **Career earnings**: Approximate total, sourced from Liquipedia/esportsearnings
- **Controller type**: Arcade stick, leverless, pad — especially if notable

---

## 4. What NOT to Include / 含めないもの

- **Negative controversies**: No tournament DQs, warnings, personal scandals, beefs.
  Keep the tone positive or neutral. This is an entertainment site.
- **Unverified rumors**: No speculation presented as fact.
- **Private information**: No addresses, personal relationships (unless publicly shared
  by the player and relevant, e.g., Fuudo's marriage is public and celebrated).
- **Outdated negative narratives**: A player's rough patch is OK to mention in passing
  as part of a comeback arc, but don't dwell on failures.

**Tone**: Pro-wrestling energy is actively encouraged. This is an entertainment
site — the bio should read like a character introduction, not a Wikipedia article.
Hype up rivalries, dramatic storylines, underdog arcs, and larger-than-life moments.
The reader should come away thinking "I need to watch this player's matches."

Guidelines for entertainment value:
- Lean into player personas: Punk's trash talk era, Daigo's stoic legend status,
  Itabashi Zangief's grappler-or-die philosophy, Blaz's teenage fearlessness
- Frame rivalries dramatically: "the rematch everyone demanded", "a score to settle"
- Use descriptive language for playstyle: not just "aggressive" but "relentless
  pressure that leaves opponents gasping for air"
- Celebrate absurd/fun facts: Kilzyou's FIFA-to-FGC pipeline, Bonchan's mahjong
  parlor origins, Fuudo's 2D-and-3D double crown
- Include crowd reactions and hype moments when documented
- Treat the FGC like the sport it is — these are athletes with story arcs
- As long as nobody gets hurt, lean into the entertainment. If a player says
  something bold or funny publicly, that is fair game and makes the bio better
- When in doubt: would a fight night commentator say this? If yes, include it

---

## 5. Research Sources / リサーチソース

### Mandatory (must check):
1. **Liquipedia** (liquipedia.net/fighters/) — Primary source for facts, dates,
   earnings, team history, tournament results
2. **Official SFL / Capcom Pro Tour pages** — For SFL rosters, CPT standings

### Recommended (for episodes, color, depth):
3. **EventHubs** — Tournament recaps, interviews, community news
4. **DashFight** — Player profiles, match analysis, interviews
5. **Esports World Cup / EVO official sites** — Event-specific details
6. **YouTube** (EvoFGC, CapcomFighters, etc.) — Match footage, post-match interviews
7. **Player social media** (Twitter/X, Instagram) — Self-disclosed info only
8. **FGC media** (Sajam, theScore esports, HiFight, etc.) — Documentary-style content
9. **saiganak.com** — Particularly good for Japanese SFL interviews and event reports
10. **fgamers.saikyou.biz** — Japanese player wiki with detailed profiles
    (Tier S players often have extensive entries with episode-level detail)

### Handling uncertain information:
- Use "approximately" / "約" for estimated figures
- Use "reportedly" / "とされる" for single-source claims
- Omit rather than guess if no reliable source exists
- Never fabricate episodes or quotes

---

## 6. Player Tier System / 選手Tierシステム

Each player is assigned a tier stored in the `player_tier` column (internal use).
This determines bio depth expectations and update priority.

**Tier assignment is based on OVERALL INDUSTRY CONTRIBUTION AND POPULARITY,
not just tournament results.** Evaluation criteria include: competitive achievements,
community impact, sponsorships, streaming activity, charisma, and media exposure.

### Tier S — Legends & Major Title Holders
**Criteria**: EVO champion, Capcom Cup champion, EWC champion, or historically
significant figure who shaped the FGC. Must also have substantial industry
presence beyond tournament results (sponsorships, streaming, media, community
building, mentorship).
**Bio expectation**: 400-800+ words per language. Full backstory, multiple episodes,
character history across game generations, rivalry narratives, memes/community
culture, playstyle analysis.
**Current roster (13 players)**:
Daigo (65), Tokido (24), Momochi (31), Fuudo (26), Punk (7), MenaRD (8),
Kazunoko (4761), Bonchan (20), Gachikun (5), Leshar (13), Mago (825),
Blaz (12), Xiao Hai (4)

### Tier A — Elite Competitors & Notable Figures
**Criteria**: Consistent Tier 1 event top-8, SFL champions/finalists, rising stars
generating significant buzz, or players with high character/entertainment value.
**Bio expectation**: 250-500 words per language. Solid backstory, key achievements,
at least 1-2 memorable episodes.
**Examples**: Sahara, Kilzyou, Higuchi, AngryBird, Big Bird, Kawano, Nemo,
GO1, Dogura, Xian, Sako, Uryo, Itabashi Zangief

### Tier B — Professional Competitors
**Criteria**: Active SFL roster members, CPT/World Warrior qualifiers, regular
tournament participants at regional/national level.
**Bio expectation**: 150-300 words per language. Core facts, team affiliation,
main achievements, SFL role.
**Examples**: Shuto, Fujimura, Moke, Otani, Seiya, Chris T, Dual Kevin, Vxbao

### Tier C — Database Entries
**Criteria**: Players entered via tournament bracket imports (top-32 etc.) who
don't yet have significant pro profiles.
**Bio expectation**: Bio may be null or minimal (1-2 sentences). Populated
opportunistically.
**Examples**: Local/regional competitors from bracket imports

### Tier Review Schedule:
- **Annual review**: Full tier reassessment once per year (suggested: post-Capcom Cup)
- **Promotion triggers**: Winning or placing top-3 at a Tier 1 event automatically
  flags a player for tier review
- **Note**: Tier placement is an internal classification for bio prioritization.
  The `player_tier` column has not yet been added to the database schema.

---

## 7. Bio Update Rules / 更新ルール

### Trigger Events for Bio Review:
| Event | Scope | Timing |
|-------|-------|--------|
| Capcom Cup | Top 8 players | Within 1 week of event |
| EVO (Las Vegas) | Top 8 players | Within 1 week of event |
| EVO Japan | Top 8 players | Within 1 week of event |
| Esports World Cup | Top 8 players | Within 1 week of event |
| SFL World Championship | All participating players | Within 1 week of event |
| SFL season start (JP/US/EU) | New roster members | At roster announcement |

### What to update:
- Add new major results to bio narrative (not just append — weave into the story)
- Update current team if changed
- Update SF6 main character if changed
- Update career earnings (or flag for auto-update)
- Reassess tier if warranted

### What NOT to do:
- Don't overwrite historical narrative — add to it
- Don't remove old achievements to make room for new ones
- Don't update bio for minor tournament results (Tier 3+)

### Recommended Workflow for Bio Writing Sessions:

Tier S bios are long (often 1,000-2,000+ words per language). To prevent data
loss from chat context limits or session refreshes:

1. **Write 2-3 players per batch** — do not attempt all 13 Tier S in one session
2. **Generate curl commands immediately** after writing each batch
3. **Execute in terminal and confirm OK (204)** before moving to the next batch
4. **Save a session log** at the end of each session summarizing:
   - Which players were updated (id, name, status)
   - Which players remain (with current bio status: null / short / needs-rewrite)
   - Any open issues or decisions deferred
5. **When starting a new chat session**, paste the following into the new chat:
   - The most recent session log
   - This style guide (or its location: docs/player-bio-style-guide.md)
   - The curl command template from Section 12
6. **Single-quote escaping**: All apostrophes inside bio text must be escaped
   as '\'' in the shell command. This is the most common source of curl failures.

---

## 8. Automated Data (Separate from Bio) / 自動更新データ

The following data is NOT part of the bio text and should be updated
automatically via API integrations:

### recent_results (JSON column — to be added):
Example schema:

    {
      "results": [
        {
          "event": "Capcom Cup 12",
          "date": "2026-03-14",
          "placement": 1,
          "character": "Ed",
          "prize_usd": 1000000
        }
      ],
      "last_updated": "2026-03-15T00:00:00Z"
    }

### total_sf6_earnings_usd (existing column):
- Updated after each major event via start.gg API or manual entry

### Data Sources for Automation:
- start.gg API: Tournament brackets, placements, entrants
  (preferred for events using start.gg, e.g., DreamHack Birmingham)
- Liquipedia API: Career earnings, team changes
- Manual fallback: For events not on start.gg (e.g., Capcom Cup)

### New Player Addition Rules:
1. After each major tournament: import top-32 bracket, cross-reference with
   existing DB, INSERT any new players (Tier C by default)
2. At each SFL season announcement: add all roster members not yet in DB
3. New players get basic metadata (handle, country, team, main character)
   immediately; bio is written based on tier assignment

---

## 9. Writing Checklist / 執筆チェックリスト

Before submitting a bio, verify:

- [ ] Liquipedia page consulted for facts
- [ ] At least one additional source consulted for Tier S/A players
- [ ] Real name included (if publicly known)
- [ ] Birth date included (if publicly known)
- [ ] Current team is accurate as of writing date
- [ ] SF6 main character(s) listed
- [ ] SFL participation noted (if applicable)
- [ ] Major achievements mentioned with years
- [ ] Career earnings figure included with "approx." qualifier
- [ ] No negative controversies or unverified claims
- [ ] Japanese bio reads naturally in Japanese (not a translation)
- [ ] English bio reads naturally in English (not a translation)
- [ ] Tone is entertaining, respectful, and hype-appropriate
- [ ] Length matches player tier expectations
- [ ] Handle origin / nickname origin included (Tier S/A)
- [ ] At least one memorable episode or meme included (Tier S/A)
- [ ] Playstyle description included (Tier S/A)
- [ ] H2H rivalry context referenced where data exists (Tier S/A)

---

## 10. Reference Bios — Tier S Gold Standard

The following players have completed Tier S detailed biographies in the database.
Use these as reference for tone, depth, and structure when writing new bios:

| Player | DB id | Updated | Notes |
|--------|-------|---------|-------|
| Tokido | 24 | 2026-03-18 | Full narrative: origin, EVO 2017, Murderface, Kemonomichi, SFL 2025, memes |
| Daigo (梅原大吾) | 65 | 2026-03-18 | Full narrative: prodigy era, Moment #37, retirement/return, Guile Village, REJECT |
| Punk | 7 | 2026-03-18 | Full narrative: netplay origin, 2017 dominance, EVO 2017 loss, EVO 2024 redemption |
| MenaRD | 8 | 2026-03-18 | Full narrative: Dominican origin, CC 2017, community reinvestment, Grand Slam, Capcom-DR partnership |
| Fuudo (ふ～ど) | 26 | 2026-03-18 | Full narrative: VF to SF transition, EVO 2011, 2D/3D double crown, REJECT, Kuramochi marriage |
| Momochi (ももち) | 31 | 2026-03-18 | Full narrative: ninja ancestry, triple crown, Shinobism, Chocoblanka, ZETA DIVISION |

---

## 11. Site Design Philosophy / サイトデザイン思想

This database powers an entertainment-first fighting game site.
The core design philosophy leans into the "fight night" aesthetic:

### The Vision
Think UFC Fight Night meets ESPN player profiles. Every element of the site
should make the viewer feel like they are watching a major sporting event.
H2H (Head to Head) data is the backbone — rivalry narratives are built on
real match data, not just vibes.

### How Bio Integrates with H2H
- Player bios provide the STORY ("Tokido and Daigo have battled across three
  decades of Street Fighter, from arcades to sold-out arenas")
- H2H data provides the PROOF ("Career H2H: Tokido 15 - 12 Daigo")
- Together they create a fight-card experience: when a user views a matchup,
  they see the stats AND the narrative, like a pre-fight hype package

### Frontend Direction (Future)
- Player profile pages: bio + recent results + H2H records against key rivals
- Matchup pages: side-by-side tale-of-the-tape style presentation
- Pre-tournament features: "paths to collision" showing potential bracket matchups
  with historical rivalry context
- Post-tournament recaps: updated bios woven with fresh results
- Visual tone: bold, high-contrast, fight-night energy — not sterile esports stats

### Bio Writing with H2H in Mind
When writing bios, consider which rivalries have H2H data in the database.
Reference specific opponents and series results where possible:
- GOOD: "At CC12, Blaz defeated Fuudo in a grueling 5-4 set — their third
  meeting at a major, with Blaz now leading the series 2-1"
- BASIC: "At CC12, Blaz placed 3rd"

The bio should make the reader want to click through to the H2H page.

---

## 12. Technical Reference / 技術リファレンス

### Database Schema (bio-related columns):
- bio (text): Japanese biography
- bio_en (text): English biography
- player_tier (text): S / A / B / C — NOT YET ADDED, internal use only
- recent_results (jsonb): Auto-updated tournament results — NOT YET ADDED
- total_sf6_earnings_usd (float): Existing column

### Supabase Update Command (curl):

    # Step 1: Load environment
    cd ~/sf6-database && source .env.local

    # Step 2: Define update function
    update_player() {
      local ID=$1
      local BIO=$2
      local BIO_EN=$3

      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/players?id=eq.${ID}" \
        -X PATCH \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"bio\":$(echo "$BIO" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),\"bio_en\":$(echo "$BIO_EN" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}")

      if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
        echo "OK  id=${ID} (${HTTP_CODE})"
      else
        echo "FAIL id=${ID} (${HTTP_CODE})"
      fi
      sleep 0.5
    }

    # Step 3: Execute (example)
    update_player 24 \
    'Japanese bio text here...' \
    'English bio text here...'

### Key Technical Notes:
- requests Python module is not available in the environment;
  use curl + python3 JSON escaping
- Single quotes inside bio text MUST be escaped as '\''
- Environment variables NEXT_PUBLIC_SUPABASE_URL and
  SUPABASE_SERVICE_ROLE_KEY are stored in .env.local
- Table name: players
- Rate limit: 0.5s sleep between requests (built into function)
- Expected success response: HTTP 204 (No Content) or 200 (OK)

### Revert to null (if needed):

    curl -s -o /dev/null -w "%{http_code}" \
      "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/players?id=eq.${ID}" \
      -X PATCH \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"bio":null,"bio_en":null}'

---

## 13. Tier確認 & Bio進捗管理 / Tier & Bio Status

**Tier情報はデータベースが唯一の正 (Single Source of Truth)**。
ファイルでの二重管理はしない。各セッション冒頭で以下のコマンドを実行して最新状態を取得すること。

### セッション開始時のTier確認コマンド:

    cd ~/sf6-database && source .env.local
    export SUPABASE_SERVICE_ROLE_KEY
    python3 -c "
    import json, subprocess, os
    url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    for tier in ['S', 'A']:
        r = subprocess.run(['curl','-s',
            f'{url}/rest/v1/players?select=id,handle,bio,bio_en&tier=eq.{tier}&order=id.asc',
            '-H',f'apikey: {key}','-H',f'Authorization: Bearer {key}'],
            capture_output=True, text=True)
        data = json.loads(r.stdout)
        print(f'
Tier {tier}: {len(data)} players')
        for p in data:
            bio_ja = 'DONE' if p.get('bio') else 'NULL'
            bio_en = 'DONE' if p.get('bio_en') else 'NULL'
            print(f'  {p["id"]:>6}  {p["handle"]:<25}  bio={bio_ja:<4}  bio_en={bio_en}')
    "

### Tier変更時の注意:
- **必ず `SUPABASE_SERVICE_ROLE_KEY` を使うこと**（anon key では RLS により tier への PATCH が無視される）
- **`export SUPABASE_SERVICE_ROLE_KEY`** を忘れると Python 子プロセスに渡らない
- HTTP 204 が返っても書き込まれていない場合がある → 更新後は必ず上記コマンドで確認

### Bio執筆の優先順位:
1. Tier S で bio=NULL のプレイヤー（最優先）
2. Tier S で bio が短い（Tier S 基準未満）プレイヤー
3. Tier A で bio=NULL のプレイヤー
4. Tier A で bio が短いプレイヤー

---

## 14. ハンドル表記揺れ対照表 / Handle Alias Reference

DB検索時に `handle=ilike.` でMISSになりやすい表記揺れをまとめる。
左が「よく使われる表記」、右が「DB内の正式ハンドル (id)」。

### スペース・記号系
| よく使われる表記 | DB handle | ID | 注意点 |
|---|---|---|---|
| Itabashi Zangief / 板ザン | Itabashi Zangief | 28 | スペース入り。URLエンコード必須 |
| Problem X / ProblemX | Problem-X | 58 | ハイフン表記 |
| Angry Bird / AngryBird | Angry Bird | 6 | スペース入り。id=24335 Mangry等は別人 |
| JoKeRJoKeZ | JoKeR JoKeZ | 381 | スペース入り |
| Travis Styles | Travis Styles | 55 | id=13239 Travis Compton等は別人 |
| Senor Power | Senor Power | 387 | スペース入り |
| Chris Wong / ChrisWong | Chris Wong | 3 | スペース入り |

### 短縮・別名系
| よく使われる表記 | DB handle | ID | 注意点 |
|---|---|---|---|
| Chris Tatarian / ChrisTatarian | Chris T | 25 | 短縮表記。real_name に Chris Tatarian |
| Mistah Crimson / MistahCrimson | Mister Crimson | 363 | Mistah ≠ Mister。id=12370 Crimson等は別人 |
| NotPedro | NotPedro | 50 | id=1016 Pedro等は別人 |

### チームタグ付き
| よく使われる表記 | DB handle | ID | 注意点 |
|---|---|---|---|
| Eita / エイタ | CAG/eita | 986 | チームタグ「CAG/」付き |
| Akira | RC/Akira | 917 | チームタグ「RC/」付き。id=5052等は別人 |

### 数字・サフィックス系
| よく使われる表記 | DB handle | ID | 注意点 |
|---|---|---|---|
| GameIn / Gamein | gamein99 | 374 | 数字サフィックス「99」 |
| Shaka / Shaka22 | shaka22 | 45 | 小文字+数字。id=9874 Shaka等は別人 |
| Pepito | HeyyPepito | 395 | 接頭辞「Heyy」。id=11268 Pepito は別人 |
| CrossoverRD / Crossover | CrossoverRD | 9885 | サフィックス「RD」 |
| Juninho-Ras / Juninho | JUNINHO-RAS | 3120 | 大文字+ハイフン。id=25587に重複あり |

### 日本語ハンドル
| よく使われる表記 | DB handle | ID | 注意点 |
|---|---|---|---|
| もっちー / Motchi / Motchy / MOCCHI | もっちー | 4778 | 元DB登録は "MOCCHI"(team:JOZ)。上書き修正済み |
| YHC-Mochi / YHCもち | YHC-Mochi | (別ID) | もっちー(4778)と混同注意。完全に別人 |

### その他
| よく使われる表記 | DB handle | ID | 注意点 |
|---|---|---|---|
| Kusanagi | Kusanagi | 359 | id=2876 "KUSANAGI H'" は別人 |
| MarkTheShark | MarkTheShark | 25589 | id=9208 "MarktheLark" は別人 |
| Infexious | Infexious | 25588 | — |
| Juicyjoe / JuicyJoe | Juicyjoe | 57 | 大文字小文字の揺れ |
| Fuudo / ふ〜ど | Fuudo | 26 | — |
| Mago / マゴ | Mago | 825 | — |

### DB検索時の注意事項
1. `handle=ilike.` でスペース・ハイフン・スラッシュ入りハンドルは **URLエンコード必須**
2. `*keyword*` ワイルドカード部分一致はノイズが多い → 確定IDがあれば `id=eq.XX` で直接指定
3. チームタグ付き（`RC/`, `CAG/`, `SS熊本`）ハンドルはタグなし検索でMISSになる
4. 日本語ハンドル（もっちー、ガチくん等）は `ilike` で検索可能だがURLエンコード必須
5. 同名・類似名プレイヤーが多数存在する場合は **IDの若さ**（= 早期登録 = メジャー大会出場者）で判断

---

## Changelog

### v1.2 (2026-03-18)
- Added Section 14: ハンドル表記揺れ対照表 / Handle Alias Reference
  - Categorized by: スペース・記号系 / 短縮・別名系 / チームタグ付き / 数字サフィックス系 / 日本語ハンドル / その他
  - Includes DB検索時の注意事項 (5 rules)
  - Documents known ID conflicts (e.g., Crimson variants, Pedro variants, Shaka variants)
- Updated Tier S bio status: Kazunoko (4761) and Bonchan (20) confirmed DONE
- もっちー (id=4778): handle corrected from "MOCCHI" to "もっちー", team updated to Saishunkan Sol Kumamoto
- `tier` column added to players table in database (S/A/B/C)
- Confirmed DB IDs: Chris Wong=3, Chris T=25, もっちー=4778

### v1.1 (2026-03-18)
- Updated Tier S roster: moved Fuudo, Bonchan, Leshar, Mago, Blaz from Tier A to Tier S
  based on overall industry contribution and popularity assessment
- Added Tier S bio status tracking table (Section 13)
- Added recommended workflow for bio writing sessions (Section 7)
  including 2-3 player batch size and session log practices
- Added complete curl command reference and revert command (Section 12)
- Added writing checklist items for handle origin, episodes, playstyle, H2H (Section 9)
- Updated Section 10 with 6 completed gold-standard reference bios
- Added changelog
- Fixed typos in original version

### v1.0 (2026-03-17)
- Initial creation (243 lines / 10,253 bytes)

### ID修正履歴 (2026-03-18)
以前のセッションで誤ったIDマッピングが使用されていた。以下が正しい対応：

| Player | 正しいID | 誤って使われたID | 誤IDの実際のハンドル |
|---|---|---|---|
| Torimeshi | 4478 | 826 | SUNHUI |
| pugera | 32 | 828 | Nauman (別人ではなくID重複) |
| Shuto | 822 | 829 | ZJZ |
| Higuchi | 22 | 833 | Tiger |
| Hikaru | 21 | 834 | 张昔日z_xiri |
| Yamaguchi | 959 | 835 | Qiuqiu |
| もっちー | 4778 | — | 元ハンドル "MOCCHI" から修正 |

**重要**: `export SUPABASE_SERVICE_ROLE_KEY` を忘れると tier カラムへの PATCH が RLS で無視される（HTTP 204 は返るが書き込まれない）。
