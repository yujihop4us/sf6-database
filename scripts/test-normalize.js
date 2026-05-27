import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve('/Users/yujisasaki/sf6-database', '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

function normalizePlayerName(raw) {
  let name = raw.trim()
  if (name.includes('|')) name = name.split('|').pop().trim()
  for (const tag of KNOWN_TEAM_TAGS) {
    if (name.toLowerCase().startsWith(tag.toLowerCase() + ' ')) {
      name = name.slice(tag.length).trim()
      break
    }
  }
  return name
}

function splitCamelCase(name) {
  if (/^[A-Z0-9_]+$/.test(name)) return name
  return name.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function playerSearchVariants(raw) {
  const normalized = normalizePlayerName(raw)
  const variants = new Set()
  variants.add(normalized)
  const camelSplit = splitCamelCase(normalized)
  if (camelSplit !== normalized) {
    variants.add(camelSplit)
    variants.add(camelSplit.toLowerCase())
  }
  if (normalized.includes(' ')) {
    variants.add(normalized.replace(/\s+/g, ''))
    variants.add(normalized.replace(/\s+/g, '').toLowerCase())
  }
  variants.add(normalized.toLowerCase())
  if (normalized.includes('.')) {
    variants.add(normalized.replace(/\./g, ''))
    variants.add(normalized.replace(/\./g, '').toLowerCase())
  }
  variants.add(raw.trim())
  return [...variants]
}

const testCases = [
  { input: 'REJECT ひなお',       expected: 'ひなお' },
  { input: 'FALCONS | Xiaohai',  expected: 'Xiaohai' },
  { input: 'Falcons|Xiaohai',    expected: 'Xiaohai' },
  { input: 'REJECT|ひなお',       expected: 'ひなお' },
  { input: 'SR NuckleDu',        expected: 'NuckleDu' },
  { input: 'Saishunkan Kobayan', expected: 'Kobayan' },
  { input: 'Riddle Jr.',         expected: 'Jr.' },
  { input: '8BD Vxbao',          expected: 'Vxbao' },
  { input: 'T1 OilKing',        expected: 'OilKing' },
  { input: 'EndingWalker',       expected: 'EndingWalker' },
]

console.log('=== Normalization Test ===\n')
let allPassed = true
for (const tc of testCases) {
  const result = normalizePlayerName(tc.input)
  const pass = result === tc.expected
  if (!pass) allPassed = false
  console.log(`${pass ? 'PASS' : 'FAIL'} "${tc.input}" -> "${result}" (expected: "${tc.expected}")`)
}
console.log(allPassed ? '\nAll tests PASSED' : '\nSome tests FAILED')

console.log('\n=== DB Search Test ===\n')
for (const tc of testCases) {
  const variants = playerSearchVariants(tc.input)
  let found = null

  // Pass 1: exact ilike
  for (const v of variants) {
    if (v.length < 2) continue
    const { data } = await supabase.from('players').select('id, handle').ilike('handle', v).limit(3)
    if (data && data.length > 0) {
      found = data[0]
      break
    }
  }

  // Pass 2: fuzzy on normalized
  if (!found) {
    const normalized = variants[0]
    const { data } = await supabase.from('players').select('id, handle').ilike('handle', `%${normalized}%`).limit(3)
    if (data && data.length > 0) found = data[0]
  }

  const variantsStr = variants.slice(0, 4).join(', ')
  console.log(`"${tc.input}" -> variants=[${variantsStr}] -> DB: ${found ? `"${found.handle}" (id=${found.id})` : 'NOT FOUND'}`)
}
