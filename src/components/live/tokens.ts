// ── Shared design tokens for live page components ─────────────────────────────

export const V = {
  bg:        '#080c14',
  surface:   '#0d1520',
  surface2:  '#111d2e',
  surface3:  '#162135',
  border:    'rgba(255,255,255,0.07)',
  border2:   'rgba(16,185,129,0.25)',
  accent:    '#10b981',
  accentDim: 'rgba(16,185,129,0.12)',
  text:      '#f1f5f9',
  muted:     '#94a3b8',
  dim:       '#475569',
  red:       '#ff4d6a',
  gold:      '#f5c842',
  P1:        '#ec4899',
  P2:        '#3b82f6',
  FD:        "'Barlow Condensed', sans-serif",
  FB:        "'Barlow', sans-serif",
} as const

export const CHAR_COLORS: Record<string, string> = {
  'Akuma':'#8b2fc9','Cammy':'#2e9e5b','Chun-Li':'#3d7ef5',
  'Dee Jay':'#f5a623','Ed':'#4a7fd4','Guile':'#4a90d9',
  'JP':'#9b4dca','Juri':'#d43f8c','Ken':'#d45f00',
  'Luke':'#c8a820','M.Bison':'#9b1a1a','Manon':'#c86490',
  'Marisa':'#8b6914','Rashid':'#50c8c8','Ryu':'#e04040',
  'Blanka':'#3da840','Dhalsim':'#e85c2a','E. Honda':'#e84848',
  'Kimberly':'#ff6b35','Lily':'#7ec850','Zangief':'#d43c3c',
  'Jamie':'#d48820','Terry':'#c83232','Mai':'#e85c7a','Elena':'#30b040',
  'A.K.I':'#7bc87b',
}

export function cc(char?: string | null): string {
  return (char && CHAR_COLORS[char]) || '#556677'
}

export function codeToFlag(code?: string | null): string {
  if (!code || code.length < 2) return '🏳'
  return code.toUpperCase().slice(0, 2).split('').map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('')
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface Player {
  id: number
  handle: string
  country_code?: string
  main_character?: string
  team?: string
  total_sf6_earnings_usd?: number
  profile_image_url?: string
}

export interface SetData {
  id: number
  tournament_id: number
  round_text: string
  winner_id: number
  loser_id: number
  winner_score: number
  loser_score: number
  display_score: string
  tournament_name: string
  tournament_date: string
}

export interface H2HData {
  player1: Player
  player2: Player
  summary: { player1_wins: number; player2_wins: number; total_sets: number }
  sets: SetData[]
}
