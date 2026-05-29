export type Locale = 'ja' | 'en'

export const translations = {
  ja: {
    // nav
    nav_home: 'ホーム',
    nav_tournaments: '大会',
    nav_live: 'ライブ',
    nav_players: '選手',
    // player page
    sec_bio: 'プロフィール',
    sec_results: '大会戦績',
    sec_h2h: 'Head-to-Head',
    sec_chars: '使用キャラ',
    stat_prize: '総獲得賞金',
    col_tournament: '大会名',
    col_date: '日程',
    col_placement: '順位',
    col_prize: '獲得賞金',
    col_char: '使用キャラ',
    h2h_subtitle: 'Head-to-Head',
    char_subtitle: '使用キャラクター',
    wins_label: '勝',
    losses_label: '敗',
    team_label: '所属',
    achievement_label: '主要タイトル',
    // home page
    home_live: 'ライブ開催中',
    home_upcoming: '開催予定',
    home_past: '過去の大会',
    home_recent: '最新結果',
    home_view_all: 'すべて見る',
    home_watch: '観戦する',
    home_goto: 'ブラケットへ',
    home_no_upcoming: '開催予定の大会はありません',
    // tournaments page
    tlist_title: '大会一覧',
    col_date2: '開催日',
    col_location: '場所',
    col_entrants: '参加者',
    col_prizepool: '賞金',
    col_status: 'ステータス',
    status_upcoming: '予定',
    status_completed: '終了',
    status_live: 'LIVE',
    // common
    champion: '優勝',
    runner_up: '準優勝',
    top4: 'Top 4',
    top8: 'Top 8',
    top16: 'Top 16',
    top32: 'Top 32',
    placement: '順位',
    no_data: 'データなし',
  },
  en: {
    // nav
    nav_home: 'Home',
    nav_tournaments: 'Tournaments',
    nav_live: 'Live',
    nav_players: 'Players',
    // player page
    sec_bio: 'Profile',
    sec_results: 'Results',
    sec_h2h: 'Head-to-Head',
    sec_chars: 'Characters',
    stat_prize: 'Total Earnings',
    col_tournament: 'Tournament',
    col_date: 'Date',
    col_placement: 'Placement',
    col_prize: 'Prize',
    col_char: 'Character',
    h2h_subtitle: 'Head-to-Head',
    char_subtitle: 'Character Usage',
    wins_label: 'W',
    losses_label: 'L',
    team_label: 'Team',
    achievement_label: 'Major Titles',
    // home page
    home_live: 'Live Now',
    home_upcoming: 'Upcoming',
    home_past: 'Past Tournaments',
    home_recent: 'Recent Results',
    home_view_all: 'View All',
    home_watch: 'Watch',
    home_goto: 'View Bracket',
    home_no_upcoming: 'No upcoming tournaments',
    // tournaments page
    tlist_title: 'Tournaments',
    col_date2: 'Date',
    col_location: 'Location',
    col_entrants: 'Entrants',
    col_prizepool: 'Prize Pool',
    col_status: 'Status',
    status_upcoming: 'Upcoming',
    status_completed: 'Completed',
    status_live: 'LIVE',
    // common
    champion: 'Champion',
    runner_up: 'Runner-up',
    top4: 'Top 4',
    top8: 'Top 8',
    top16: 'Top 16',
    top32: 'Top 32',
    placement: 'Placement',
    no_data: 'No data',
  },
} as const

export type T = Record<keyof typeof translations.ja, string>

// ─── Tournament page UI text constants ───────────────────────────
// デフォルト値は日本語。将来 locale パラメータで切り替えられるよう
// translations オブジェクトに統合予定。
export const UI_TEXT = {
  // Tab labels
  standings:     '順位表',
  bracket:       'ブラケット',
  charStats:     'Top 24 キャラ統計',
  // Hero stat cards
  participants:  '参加者数',
  totalMatches:  '総試合数',
  totalPrize:    '総賞金額',
  // Standings
  fourthAndBelow:       '4位以降',
  searchPlaceholder:    '選手名で検索...',
  playersDisplayed:     '選手表示',
  showAllPlayers:       '全選手を表示',
  showTopPlayers:       'Top 32 のみ表示',
  estimatedPlacementNote: '* 順位はセットデータから推定（DBに正式な順位データなし）',
  // Table headers
  colRank:       '順位',
  colPlayer:     '選手名',
  colFlag:       '国旗',
  colCharacter:  '使用キャラ',
  colPrize:      '賞金',
  colCpt:        'CPT',
  colEwc:        'EWC',
  // Section heads
  sectionStandings:  '順位表',
  sectionBracket:    'ブラケット',
  sectionCharStats:  'Top 24 キャラ統計',
  sectionBracketSub: 'DOUBLE ELIM',
  sectionCharSub:    'USAGE · TOP BRACKET',
  // Qualification badges
  ccQualified:   'CC Qualified',
  ewcQualified:  'EWC Qualified',
  // Bracket
  bracketNoData:     'ブラケットデータなし',
  charStatsNoData:   'Top 24 ブラケットのキャラデータなし',
  charStatsFootnote: '※ CPTポイント獲得圏内（Top 24）の選手が使用したキャラクターの分布',
} as const

export type UITextKey = keyof typeof UI_TEXT
