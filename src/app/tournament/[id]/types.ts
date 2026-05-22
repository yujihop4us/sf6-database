export interface TournamentInfo {
  id: number
  name: string
  startDate: string | null
  endDate: string | null
  location: string
  prizeUsd: number | null
  isOnline: boolean
  format: string | null
  region: string | null
  /** 実際のエントラント数（start.gg の正式値。未設定なら DB 値を使用） */
  numEntrantsOverride?: number
  /** 実際のセット総数（start.gg の正式値。未設定なら DB 値を使用） */
  totalSetsOverride?: number
}

export interface PlayerInfo {
  id: number
  handle: string
  countryCode: string | null
  character: string | null
  /** Characters actually used in this tournament, frequency-sorted, '/' separated */
  usedCharacters: string | null
  team: string | null
  imageUrl: string | null
  wins: number
  losses: number
}

export interface EntrantRow {
  entrantId: number
  placement: number | null
  /** placement inferred from sets when DB value is null */
  inferredPlacement: number | null
  seed: number | null
  prizeAmount: number | null
  player: PlayerInfo | null
}

export interface SetRow {
  id: number
  roundText: string
  phase: string
  displayScore: string
  winnerScore: number
  loserScore: number
  winnerId: number | null
  loserId: number | null
  winnerHandle: string
  winnerCountry: string | null
  winnerCharacter: string | null
  loserHandle: string
  loserCountry: string | null
  loserCharacter: string | null
  /** Inferred label when DB round_text is a generic phase name */
  inferredRoundLabel: string | null
  isGrandFinal: boolean
}

export interface TournamentData {
  tournament: TournamentInfo
  entrants: EntrantRow[]
  sets: SetRow[]
  totalMatches: number
}
