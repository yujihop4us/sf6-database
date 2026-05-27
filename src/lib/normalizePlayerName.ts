/**
 * start.gg のスポンサータグ付きハンドルを正規化する
 * 例: "REJECT ひなお"  → "ひなお"  (REJECT は既知タグ)
 *     "FALCONS | Xiaohai" → "Xiaohai"
 *     "Falcons|Xiaohai"   → "Xiaohai"
 *     "Saishunkan Kobayan" → "Kobayan"
 *     "T1 OilKing"        → "OilKing"
 */

// 既知のスポンサー/チームタグ (大文字・小文字どちらも対応)
// ※ 長いタグほど先に並べることで誤マッチを防ぐ
const KNOWN_TEAM_TAGS = [
  'Saishunkan', 'Yesports', 'Nemesis', 'Heretics', 'Bandits',
  'Illicit', 'Vision', 'Dopecord',
  'FALCONS', 'Falcons', 'REJECT', 'Riddle', 'Varrel', 'Scarz',
  'CR', 'DFM', 'ONIC', 'Zeta', 'FAV', 'NIP', 'GL', 'SR', 'WBG',
  'G8S', 'EVG', 'T1', '8BD', 'AG', 'Mouz', 'VIT',
  'TM', 'CTG', 'MRG', 'PAR', 'ONi', 'TEC', 'EG', 'SBI',
  'KT', 'PCH', 'TNS', 'RB', 'Kanme', 'STG', 'TPBE', 'BBB',
  'EVX', '4o4', 'ECHT', 'PWS', 'LAV', 'Sycom', 'RR', 'JH',
  'iXA', 'UA', '585Z', 'T7G',
]

/**
 * start.gg のスポンサータグ付きハンドルを正規化して返す。
 * スポンサータグが除去できない場合は元の文字列をトリムして返す。
 */
export function normalizePlayerName(raw: string): string {
  let name = raw.trim()

  // Step 1: パイプ区切り除去 "TEAM | Name" or "TEAM|Name"
  if (name.includes('|')) {
    name = name.split('|').pop()!.trim()
  }

  // Step 2: 既知チームタグ + スペースのプレフィックス除去
  for (const tag of KNOWN_TEAM_TAGS) {
    const prefix = tag.toLowerCase() + ' '
    if (name.toLowerCase().startsWith(prefix)) {
      name = name.slice(tag.length).trim()
      break
    }
  }

  return name
}

/**
 * CamelCase を単語区切りに展開する
 * 例: "XiaoHai" → "Xiao Hai", "OilKing" → "Oil King", "NuckleDu" → "Nuckle Du"
 * ただし全て大文字の単語はそのまま ("CR", "DFM" など)
 */
function splitCamelCase(name: string): string {
  // 全て大文字 or 数字だけなら変換しない
  if (/^[A-Z0-9_]+$/.test(name)) return name
  // CamelCase を スペース区切りに
  return name.replace(/([a-z])([A-Z])/g, '$1 $2')
}

/**
 * DB 検索に使うバリアント一覧を返す。
 * 優先度順: 正規化後の完全一致 → CamelCase展開 → スペース除去 → 元の文字列
 */
export function playerSearchVariants(raw: string): string[] {
  const normalized = normalizePlayerName(raw)
  const variants = new Set<string>()

  // 正規化後
  variants.add(normalized)

  // CamelCase → スペース区切り (例: "Xiaohai" → "Xiao hai", "OilKing" → "Oil King")
  const camelSplit = splitCamelCase(normalized)
  if (camelSplit !== normalized) {
    variants.add(camelSplit)
    variants.add(camelSplit.toLowerCase())
  }

  // スペース除去バリアント (例: "Xiao Hai" → "XiaoHai")
  if (normalized.includes(' ')) {
    variants.add(normalized.replace(/\s+/g, ''))
    variants.add(normalized.replace(/\s+/g, '').toLowerCase())
  }

  // 小文字バリアント
  variants.add(normalized.toLowerCase())

  // "." 除去バリアント (例: "Jr." → "Jr")
  if (normalized.includes('.')) {
    variants.add(normalized.replace(/\./g, ''))
    variants.add(normalized.replace(/\./g, '').toLowerCase())
  }

  // 元の文字列もフォールバックとして含める
  variants.add(raw.trim())

  return [...variants]
}
