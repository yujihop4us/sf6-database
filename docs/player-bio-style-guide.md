# SF6 Database — Player Bio Style Guide & Rules
# プレイヤーBio スタイルガイド & ルール

> Version: 1.0
> Created: 2026-03-17
> Last Updated: 2026-03-17

---

## 1. Bio Overview / 概要

Each player in the database has two bio fields:
- `bio` — Japanese language biography
- `bio_en` — English language biography

These are NOT direct translations. Each is written to feel natural in its language,
with cultural context appropriate for the target audience.
- Japanese: FGC日本コミュニティに馨染む文興・ニュアンスで執筆
- English: Global/Western FGC audience向けに響く文興で執筆

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

## 3. Recommended Fields / 推奈項盭 (include when available)

- **Career origin story**: How they got into fighting games, early arcade days, etc.
- **Major titles & achievements**: EVO wins, Capcom Cup, EWC, SBO, etc. with years
- **Character history**: Evolution of character choices across SF generations
- **Epithet / Nickname**: "Murder Face", "2D God", "The Prodigy" — and origin if known
- **Handle origin**: Why they chose their tag (e.g., Tokido = "闣気道")
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

### Handling uncertain information:
- Use "approximately" / "約" for estimated figures
- Use "reportedly" / "とされる" for single-source claims
- Omit rather than guess if no reliable source exists
- Never fabricate episodes or quotes

---

## 6. Player Tier System / 選手Tierシステム

Each player is assigned a tier stored in the `player_tier` column.
This determines bio depth expectations and update priority.

### Tier S — Legends & Major Title Holders
**Criteria**: EVO champion, Capcom Cup champion, EWC champion, or historically
significant figure who shaped the FGC (even if recent results are modest).
**Bio expectation**: 400-800+ words per language. Full backstory, multiple episodes,
character history across game generations, rivalry narratives.
**Examples**: Daigo, Tokido, MenaRD, Sako, Kazunoko, Xiao Hai, Punk, AngryBird

### Tier A — Elite Competitors & Notable Figures
**Criteria**: Consistent Tier 1 event top-8, SFL champions/finalists, rising stars
generating significant buzz, or players with high character/entertainment value.
**Bio expectation**: 250-500 words per language. Solid backstory, key achievements,
at least 1-2 memorable episodes.
**Examples**: Leshar, Sahara, Blaz, Kilzyou, Higuchi, Fuudo, Mago, Nemo, Big Bird,
Bonchan, GO1, Dogura, Xian

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
- Add new major results to bio narrative (not just append - weave into the story)
- Update current team if changed
- Update SF6 main character if changed
- Update career earnings (or flag for auto-update)
- Reassess tier if warranted

### What NOT to do:
- Don't overwrite historical narrative - add to it
- Don't remove old achievements to make room for new ones
- Don't update bio for minor tournament results (Tier 3+)

---

## 8. Automated Data (Separate from Bio) / 自動更新データ

The following data is NOT part of the bio text and should be updated
automatically via API integrations:

recent_results (JSON column - to be added):
Example schema:
{"results":[{"event":"Capcom Cup 12","date":"2026-03-14","placement":1,"character":"Ed","prize_usd":1000000}],"last_updated":"2026-03-15T00:00:00Z"}

total_sf6_earnings_usd (existing column):
- Updated after each major event via start.gg API or manual entry

Data Sources for Automation:
- start.gg API: Tournament brackets, placements, entrants
- Liquipedia API: Career earnings, team changes
- Manual fallback: For events not on start.gg

New Player Addition Rules:
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

---

## 10. Example Bio — Tier S Reference (Tokido)

See database entry for player id=24 (Tokido) as the gold standard reference.
Both `bio` and `bio_en` fields demonstrate the expected depth, tone, and structure
for a Tier S player biography.


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

## 12. Technical Notes / 技衳メモ

Database columns used:
- bio (text): Japanese biography
- bio_en (text): English biography
- player_tier (text): S / A / B / C (to be added)
- recent_results (jsonb): Auto-updated tournament results (to be added)
- total_sf6_earnings_usd (float): Existing column

Update method:
- Bio updates via Supabase REST API PATCH using SUPABASE_SERVICE_ROLE_KEY
- Rate limit: 0.5s sleep between requests
- Always use python3 JSON escaping for bio text in curl commands

Future automation:
- Claude Code / openClaw can reference this document at
  docs/player-bio-style-guide.md in the repository
- When tasked with writing bios, the AI should:
  1. Read this guide first
  2. Check player's current tier
  3. Research via Liquipedia + additional sources per tier
  4. Write both JP and EN bios
  5. Run through the checklist (Section 9)
  6. Submit via Supabase API