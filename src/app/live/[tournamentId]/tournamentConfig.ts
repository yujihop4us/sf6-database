// ── 大会設定 ─────────────────────────────────────────────────────────────────
// page.tsx から抽出。新大会を追加する場合はここに追記する。

export interface TournamentConfig {
  name: string
  streamPlatform: 'twitch' | 'youtube' | null
  streamChannel: string | null
  twitchChannels?: { name: string; channel: string }[]
  twitchChatChannels?: string[]
  startggEventId?: number
  startDate?: string
  endDate?: string
  dbTournamentId?: number   // Supabase tournaments.id
  ewcQualifier?: boolean
  ewcSlots?: number
  cptPremier?: boolean
  locationLabel?: string
  timezone: string
  streamStartTime?: string
  totalDays: number
  phases: any[]
  results: any[]
  /** デモモードフラグ: 実データAPIを一切呼ばずモックデータで動作 */
  isDemo?: boolean
}

export const TOURNAMENT_CONFIG: Record<string, TournamentConfig> = {
  '9': {
    name: 'Capcom Cup 12',
    streamPlatform: null, streamChannel: null,
    startDate: '2026-03-11', endDate: '2026-03-15',
    timezone: 'Asia/Tokyo', totalDays: 4,
    phases: [
      { name: 'Phase 1', format: 'GSL (Double Elim) — FT3', groups: [
        { name: 'Group A', players: [{ name: 'Xiao Hai' }, { name: 'Blaz' }, { name: 'HotDog29' }, { name: 'Juicyjoe' }], matches: [
          { player1: 'Xiao Hai', player2: 'Juicyjoe', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'Blaz', player2: 'HotDog29', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group B', players: [{ name: 'Kawano' }, { name: 'Fuudo' }, { name: 'EndingWalker' }, { name: 'Bravery' }], matches: [
          { player1: 'Kawano', player2: 'EndingWalker', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'Fuudo', player2: 'Bravery', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group C', players: [{ name: 'Big Bird' }, { name: 'DakCorgi' }, { name: 'YHC-Mochi' }, { name: 'MenaRD' }], matches: [
          { player1: 'Big Bird', player2: 'YHC-Mochi', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'DakCorgi', player2: 'MenaRD', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group D', players: [{ name: 'NL' }, { name: 'Sahara' }, { name: 'shaka22' }, { name: 'JabhiM' }], matches: [
          { player1: 'Sahara', player2: 'shaka22', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'NL', player2: 'JabhiM', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group E', players: [{ name: 'YONANGEL' }, { name: 'Dual Kevin' }, { name: 'Caba' }, { name: 'pugera' }], matches: [
          { player1: 'YONANGEL', player2: 'Caba', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'Dual Kevin', player2: 'pugera', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group F', players: [{ name: 'kincho' }, { name: 'Momochi' }, { name: 'Angry Bird' }, { name: 'Tashi' }], matches: [
          { player1: 'kincho', player2: 'Angry Bird', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'Momochi', player2: 'Tashi', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group G', players: [{ name: 'gachikun' }, { name: 'Kobayan' }, { name: 'Vxbao' }, { name: 'NotPedro' }], matches: [
          { player1: 'gachikun', player2: 'Vxbao', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'Kobayan', player2: 'NotPedro', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group H', players: [{ name: 'Leshar' }, { name: 'Ryukichi' }, { name: 'LUGABO' }, { name: 'Travis Styles' }], matches: [
          { player1: 'Leshar', player2: 'LUGABO', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'Ryukichi', player2: 'Travis Styles', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group I', players: [{ name: 'Higuchi' }, { name: 'ARMAKOF' }, { name: 'Tokido' }, { name: 'Xerna' }], matches: [
          { player1: 'Higuchi', player2: 'Tokido', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'ARMAKOF', player2: 'Xerna', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group J', players: [{ name: 'Rainpro' }, { name: 'Chris T' }, { name: 'Lexx' }, { name: 'Micky' }], matches: [
          { player1: 'Rainpro', player2: 'Lexx', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'Chris T', player2: 'Micky', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group K', players: [{ name: 'Kilzyou' }, { name: 'NuckleDu' }, { name: 'Hinao' }, { name: 'lllRaihanlll' }], matches: [
          { player1: 'Kilzyou', player2: 'Hinao', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'NuckleDu', player2: 'lllRaihanlll', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
        { name: 'Group L', players: [{ name: 'JAK' }, { name: 'Itabashi Zangief' }, { name: 'Deiver' }, { name: 'Jiewa' }], matches: [
          { player1: 'JAK', player2: 'Deiver', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'Itabashi Zangief', player2: 'Jiewa', round: 'Opening Matches', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Winners Match', date: 'Mar 11', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Elimination Match', date: 'Mar 12', status: 'upcoming' },
          { player1: 'TBD', player2: 'TBD', round: 'Decider Match', date: 'Mar 12', status: 'upcoming' },
        ] },
      ] },
      { name: 'Phase 2', format: 'Round Robin — FT3', groups: [
        { name: 'Group 1', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
        { name: 'Group 2', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
        { name: 'Group 3', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
        { name: 'Group 4', players: [{ name: 'TBD' }, { name: 'TBD' }, { name: 'TBD' }], matches: [] },
      ] },
      { name: 'Phase 3', format: 'Single Elim — FT5', groups: [
        { name: 'Top 16', players: Array(16).fill({ name: 'TBD' }), matches: [] },
      ] },
    ],
    results: [],
  },

  'dreamhack-birmingham': {
    name: 'DreamHack Birmingham 2026',
    streamPlatform: 'twitch', streamChannel: 'dreamhackfighters',
    startDate: '2026-03-27', endDate: '2026-03-29',
    timezone: 'Europe/London', totalDays: 2,
    startggEventId: 1554815,
    phases: [
      { name: 'Pools', format: 'Double Elimination Pools', groups: [{ name: 'Pool 1', players: Array(32).fill({ name: 'TBD' }), matches: [] }] },
      { name: 'Top 32', format: 'Double Elimination', groups: [{ name: 'Main Bracket', players: Array(32).fill({ name: 'TBD' }), matches: [] }] },
    ],
    results: [],
  },

  '40': {
    name: 'EVO Japan 2026',
    streamPlatform: 'twitch', streamChannel: 'evo',
    twitchChannels: [
      { name: 'EVO (EN)',          channel: 'evo' },
      { name: 'EVO Japan 1 (JP)', channel: 'evojapan01' },
      { name: 'EVO Japan 2 (JP)', channel: 'evojapan02' },
      { name: 'EVO Japan 3 (JP)', channel: 'evojapan03' },
      { name: 'EVO Japan 4 (JP)', channel: 'evojapan04' },
    ],
    twitchChatChannels: ['evo', 'evojapan01', 'evojapan02', 'evojapan03', 'evojapan04'],
    startDate: '2026-05-01', endDate: '2026-05-03',
    timezone: 'Asia/Tokyo', totalDays: 3,
    startggEventId: 1516510, dbTournamentId: 40,
    cptPremier: true,
    phases: [
      { name: 'Round 1', format: 'Double Elimination Pools', groups: [{ name: 'Pools', players: Array(32).fill({ name: 'TBD' }), matches: [] }] },
      { name: 'Finals', format: 'Double Elimination', groups: [{ name: 'Top 8', players: Array(8).fill({ name: 'TBD' }), matches: [] }] },
    ],
    results: [],
  },

  'dh-atlanta-2026': {
    name: 'Road to EWC: DreamHack Atlanta 2026',
    streamPlatform: 'twitch', streamChannel: 'ewc_plus_en2',
    twitchChannels: [
      { name: 'EWC EN2 (メイン)',  channel: 'ewc_plus_en2' },
      { name: 'EWC EN (サブ)',     channel: 'ewc_plus_en' },
    ],
    twitchChatChannels: ['ewc_plus_en2', 'ewc_plus_en'],
    startDate: '2026-05-15', endDate: '2026-05-17',
    timezone: 'America/New_York', locationLabel: 'Atlanta, GA',
    totalDays: 3,
    streamStartTime: '2026-05-16T10:00:00-04:00',
    startggEventId: 1600986, dbTournamentId: 47,
    ewcQualifier: true, ewcSlots: 2,
    cptPremier: false,
    phases: [
      { name: 'Pools',  format: 'Double Elimination', groups: [{ name: 'Pools', players: [], matches: [] }] },
      { name: 'Top 32', format: 'Double Elimination', groups: [{ name: 'Top 32', players: [], matches: [] }] },
      { name: 'Top 8',  format: 'Double Elimination Ft5', groups: [{ name: 'Top 8', players: [], matches: [] }] },
    ],
    results: [],
  },

  'blink-respawn-2026': {
    name: 'BLINK RESPAWN 2026',
    streamPlatform: 'twitch', streamChannel: 'blinkesportsrd',
    twitchChannels: [
      { name: 'Blink Esports (メイン)', channel: 'blinkesportsrd' },
    ],
    twitchChatChannels: ['blinkesportsrd'],
    startDate: '2026-06-05', endDate: '2026-06-07',
    timezone: 'America/Santo_Domingo', locationLabel: 'Santo Domingo, Dominican Republic',
    totalDays: 3,
    streamStartTime: '2026-06-06T10:00:00-04:00',
    startggEventId: 1537500, dbTournamentId: 43,
    ewcQualifier: false, ewcSlots: 0,
    cptPremier: true,
    phases: [
      { name: 'Pools',  format: 'Double Elimination', groups: [{ name: 'Pools',  players: [], matches: [] }] },
      { name: 'Top 32', format: 'Double Elimination', groups: [{ name: 'Top 32', players: [], matches: [] }] },
      { name: 'Top 8',  format: 'Double Elimination Ft5', groups: [{ name: 'Top 8', players: [], matches: [] }] },
    ],
    results: [],
  },

  'combo-breaker-2026': {
    name: 'COMBO BREAKER 2026',
    streamPlatform: 'twitch', streamChannel: 'capcomfighters',
    twitchChannels: [
      { name: 'Capcom Fighters (メイン)', channel: 'capcomfighters' },
    ],
    twitchChatChannels: ['capcomfighters'],
    startDate: '2026-05-22', endDate: '2026-05-24',
    timezone: 'America/Chicago', locationLabel: 'Schaumburg, IL',
    totalDays: 3,
    streamStartTime: '2026-05-22T10:00:00-05:00',
    startggEventId: 1528962, dbTournamentId: 48,
    ewcQualifier: true, ewcSlots: 2,
    cptPremier: true,
    phases: [
      { name: 'Round 1', format: 'Double Elimination Pools', groups: [{ name: 'Round 1', players: [], matches: [] }] },
      { name: 'Round 2', format: 'Double Elimination',       groups: [{ name: 'Round 2', players: [], matches: [] }] },
      { name: 'Round 3', format: 'Double Elimination',       groups: [{ name: 'Round 3', players: [], matches: [] }] },
      { name: 'Top 24',  format: 'Double Elimination',       groups: [{ name: 'Top 24',  players: [], matches: [] }] },
      { name: 'Top 8',   format: 'Double Elimination Ft5',   groups: [{ name: 'Top 8',   players: [], matches: [] }] },
    ],
    results: [],
  },

  // ── DEMO MODE ─────────────────────────────────────────────────────────────
  'demo': {
    name: 'DEMO MODE',
    streamPlatform: 'twitch', streamChannel: 'capcomfighters',
    twitchChannels: [
      { name: 'Capcom Fighters (デモ)', channel: 'capcomfighters' },
    ],
    twitchChatChannels: ['capcomfighters'],
    // startggEventId, dbTournamentId は意図的に未設定（APIポーリング抑止）
    startDate: '2026-01-01', endDate: '2099-12-31',
    timezone: 'UTC', locationLabel: 'DEMO — どこでもない',
    totalDays: 1,
    cptPremier: true,
    ewcQualifier: false, ewcSlots: 0,
    phases: [],
    results: [],
    isDemo: true,
  },
}

/** tournamentId (slug or numeric string) から config を解決する */
export function resolveTournamentConfig(tournamentId: string): {
  config: TournamentConfig
  configKey: string
} {
  const configKey: string = TOURNAMENT_CONFIG[tournamentId]
    ? tournamentId
    : (Object.entries(TOURNAMENT_CONFIG).find(([, c]) => c.dbTournamentId === Number(tournamentId))?.[0] ?? tournamentId)

  const config = TOURNAMENT_CONFIG[configKey] ?? {
    name: 'Tournament',
    streamPlatform: 'twitch' as const,
    streamChannel: 'capcomfighters',
    endDate: '',
    phases: [],
    results: [],
    timezone: 'UTC' as const,
    totalDays: 1,
  }

  return { config, configKey }
}
