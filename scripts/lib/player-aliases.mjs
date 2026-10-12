/**
 * player-aliases.mjs — 選手名の表記揺れを DB の handle に寄せる（唯一の定義元）
 *
 * 賞金・ポイント・Tier はすべて名寄せに依存する。ズレると「エラーは出ないが
 * その選手だけ反映されない」という静かな欠落になるため、定義を1箇所に集約する。
 *
 * 注意: 名寄せに失敗した名前は握り潰さず、呼び出し側で必ずレポートに列挙すること。
 */

/** Liquipedia / start.gg 表記 → DB の players.handle */
export const PLAYER_ALIASES = {
  'Xiaohai':        'Xiao Hai',
  'xiaohai':        'Xiao Hai',
  'AngryBird':      'Angry Bird',
  'Booce_Lee':      'Booce',
  'ChrisT':         'Chris T',
  // 参加者表では ChrisT、ブラケット内では Chris Tatarian と表記が揺れる
  'Chris Tatarian': 'Chris T',
  'Wabiichi':       'わびいち',
  'Tantanmen':      'タンタンメン',
  'Akutagawa':      'あくたがわ',
  'zabutonn':       'ざぶとん',
  'Enzo':           'EnzoTheHokage',
}

/**
 * 同一人物が DB に別の handle で（別レコードとして）存在するケース。
 * start.gg のアカウントが複数ある、チームタグ込みで登録されている等。
 * PLAYER_ALIASES と違い1対多なので、呼び出し側は候補のうち
 * 「その大会のエントラントである」ものを選ぶこと（findAll を使う）。
 *
 * 追加時は必ず順位の整合を確認すること（例: EVO France 2026 で
 * Liquipedia "Hinao" 5位タイ ⇔ DB "REJECT ひなお" 5位 を照合済み）
 */
export const PLAYER_ALT_HANDLES = {
  // Hinao は start.gg アカウントが2つあり DB も id=27 / id=25790 に分かれている
  'Hinao':     ['REJECT ひなお'],
  'tako':      ['tako956402'],
  'Crossover': ['CrossoverRD'],
  'Eita':      ['CAG/eita'],
}

/** 別名を適用（未知の名前はそのまま返す） */
export function applyAlias(name) {
  const n = String(name ?? '').trim()
  return PLAYER_ALIASES[n] ?? n
}

/**
 * 比較用キー。大小・空白・記号差を吸収する。
 * 例: "Dual Kevin" / "dual_kevin" / "DUALKEVIN" → "dualkevin"
 */
export function normalizeKey(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.\-]/g, '')
}

/**
 * DB の players 全件から「比較キー → player」の索引を作る。
 * Supabase は 1000 行で静かに切れるためページネーション必須。
 */
export async function buildPlayerIndex(supabase) {
  let all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('players')
      .select('id, handle')
      .range(from, from + 999)
    if (error) throw new Error(`players 取得失敗: ${error.message}`)
    if (!data?.length) break
    all = all.concat(data)
    if (data.length < 1000) break
  }

  const byKey = new Map()
  for (const p of all) {
    const k = normalizeKey(p.handle)
    if (!byKey.has(k)) byKey.set(k, p)
  }

  return {
    size: all.length,
    /** 名前から player を引く。別名適用 → 正規化キーで照合 */
    find(name) {
      return byKey.get(normalizeKey(applyAlias(name))) ?? null
    },
    /**
     * 同一人物の候補をすべて返す（主レコード + PLAYER_ALT_HANDLES）。
     * 複数レコードに分かれた選手を、大会ごとに正しい方へ寄せるために使う
     */
    findAll(name) {
      const n = String(name ?? '').trim()
      const keys = [applyAlias(n), ...(PLAYER_ALT_HANDLES[n] ?? [])].map(normalizeKey)
      const seen = new Set()
      const out = []
      for (const k of keys) {
        const p = byKey.get(k)
        if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p) }
      }
      return out
    },
  }
}
