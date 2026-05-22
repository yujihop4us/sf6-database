/**
 * fetch-cc11-characters.js
 *
 * Fetches CC11 per-match character data from Liquipedia (fighters wiki)
 * and updates tournament_sets.winner_character / loser_character.
 *
 * Liquipedia MediaWiki API ToS:
 *   action=parse : max 1 request per 30 seconds
 *   User-Agent   : custom with project info
 *   Accept-Encoding: gzip required
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import zlib from 'zlib';
import https from 'https';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOURNAMENT_ID = 2;
const WIKI = 'fighters';
const USER_AGENT = 'SF6Database/1.0 (sf6stats-research)';
const PARSE_DELAY_MS = 32000;

// ── HTTP ──────────────────────────────────────────────────────────
const agent = new https.Agent({ keepAlive: true });

function fetchWikitext(page) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      action: 'parse', page, prop: 'wikitext',
      format: 'json', redirects: '1',
    });
    const req = https.request({
      hostname: 'liquipedia.net',
      path: `/${WIKI}/api.php?${params}`,
      method: 'GET', agent,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Encoding': 'gzip',
      },
    }, (res) => {
      const chunks = [];
      const stream = res.headers['content-encoding'] === 'gzip'
        ? res.pipe(zlib.createGunzip()) : res;
      stream.on('data', c => chunks.push(c));
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (body.startsWith('<')) {
          reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${body.slice(0, 150)}`));
          return;
        }
        try {
          const json = JSON.parse(body);
          if (json.error) reject(new Error(`Liquipedia: ${JSON.stringify(json.error)}`));
          else resolve(json?.parse?.wikitext?.['*'] ?? '');
        } catch (e) {
          reject(new Error(`JSON parse: ${e.message}`));
        }
      });
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Wikitext parser ───────────────────────────────────────────────

/**
 * Extract the most-used character across maps for one player.
 * Handles both {{Chars|Name}} and plain text.
 */
function mostUsedChar(charList) {
  if (!charList.length) return null;
  const freq = {};
  for (const c of charList) {
    const n = normalizeChar(c);
    if (n) freq[n] = (freq[n] ?? 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const CHAR_NORMALIZE = {
  'M. Bison': 'M.Bison', 'M.Bison': 'M.Bison', 'Bison': 'M.Bison',
  'E. Honda': 'E.Honda', 'Honda': 'E.Honda',
  'Dee Jay': 'Dee Jay', 'DeeJay': 'Dee Jay',
  'A.K.I.': 'A.K.I', 'AKI': 'A.K.I', 'aki': 'A.K.I',
  'Chun': 'Chun-Li', 'Chun-Li': 'Chun-Li',
  'Kim': 'Kimberly', 'Kimberly': 'Kimberly',
  'Zangief': 'Zangief',
};

function normalizeChar(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (CHAR_NORMALIZE[t]) return CHAR_NORMALIZE[t];
  // Title-case
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Parse all {{Match ...}} blocks from wikitext.
 * Handles both group stage (|M1={{Match) and bracket (|R2M2={{Match) formats.
 */
function parseMatches(wikitext) {
  const results = [];

  // Find all `={{Match` positions — works for |M1=, |R2M2=, |LBR1M1=, etc.
  const matchRe = /=\s*(\{\{Match\b)/g;
  const matchStarts = [];
  let m;
  while ((m = matchRe.exec(wikitext)) !== null) {
    // Record position of {{ (not the = sign)
    matchStarts.push(m.index + m[0].indexOf('{{'));
  }

  for (let i = 0; i < matchStarts.length; i++) {
    const start = matchStarts[i];
    const end   = i + 1 < matchStarts.length ? matchStarts[i + 1] : wikitext.length;
    const block = wikitext.slice(start, end);

    const result = parseOneMatch(block);
    if (result) results.push(result);
  }

  return results;
}

function parseOneMatch(block) {
  // Extract opponent handles
  const opp1m = block.match(/\|opponent1\s*=\s*\{\{SoloOpponent\|([^|}\n]+)/);
  const opp2m = block.match(/\|opponent2\s*=\s*\{\{SoloOpponent\|([^|}\n]+)/);
  if (!opp1m || !opp2m) return null;

  const p1 = opp1m[1].trim();
  const p2 = opp2m[1].trim();

  // Parse line-by-line: all |o1p1= and |o2p1= lines are on a single line each,
  // so we can extract chars and map winners directly from raw lines.
  const p1chars = [], p2chars = [];
  let p1wins = 0, p2wins = 0;

  for (const line of block.split('\n')) {
    // |o1p1={{Chars|CharName}} — may appear inline with |o2p1= on same line
    const c1 = line.match(/\|o1p1\s*=\s*\{\{Chars\|([^}|]+)/);
    const c2 = line.match(/\|o2p1\s*=\s*\{\{Chars\|([^}|]+)/);
    if (c1) p1chars.push(c1[1].trim());
    if (c2) p2chars.push(c2[1].trim());

    // |winner=1 or |winner=2 (inside Map lines)
    const wm = line.match(/\|winner\s*=\s*(\d)/);
    if (wm?.[1] === '1') p1wins++;
    else if (wm?.[1] === '2') p2wins++;
  }

  return {
    p1, p2,
    p1char: mostUsedChar(p1chars),
    p2char: mostUsedChar(p2chars),
    p1wins, p2wins,
  };
}

// Handle aliases: Liquipedia name (lowercase) → DB handle (lowercase)
const HANDLE_ALIASES = {
  'xiaohai':        'xiao hai',
  'angrybird':      'angry bird',
  'juninho-ras':    'juninho-ras',   // same but keep in case
  'itabashi zangief': 'itabashi zangief',
};

function resolveHandle(raw, playerByHandle) {
  const lower = raw.toLowerCase();
  const alias = HANDLE_ALIASES[lower] ?? lower;
  return playerByHandle.has(alias) ? alias : lower;
}

// ── DB helpers ────────────────────────────────────────────────────

async function loadCC11Sets() {
  const { data, error } = await supabase
    .from('tournament_sets')
    .select('id, phase_name, winner_id, loser_id, winner_score, loser_score')
    .eq('tournament_id', TOURNAMENT_ID);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadPlayers() {
  let all = [], from = 0;
  while (true) {
    const { data } = await supabase.from('players').select('id, handle').range(from, from + 999);
    all = all.concat(data ?? []);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');

  console.log('════════════════════════════════════════════════');
  console.log(' CC11 Character Fetcher  (liquipedia.net/fighters)');
  if (DRY_RUN) console.log(' MODE: --dry-run (no DB writes)');
  console.log('════════════════════════════════════════════════\n');

  // ── Load DB data ──
  console.log('📋 Loading CC11 sets and players from DB...');
  const [sets, players] = await Promise.all([loadCC11Sets(), loadPlayers()]);
  console.log(`   ${sets.length} sets, ${players.length} players`);

  const playerById  = new Map(players.map(p => [p.id, p.handle]));
  const playerByHandle = new Map(players.map(p => [p.handle.toLowerCase(), p]));

  // Build set lookup: "winnerHandle|loserHandle" → set row
  const setByMatchup = new Map();
  for (const s of sets) {
    const wH = s.winner_id ? playerById.get(s.winner_id)?.toLowerCase() : null;
    const lH = s.loser_id  ? playerById.get(s.loser_id)?.toLowerCase()  : null;
    if (wH && lH) setByMatchup.set(`${wH}|${lH}`, s);
  }
  console.log(`   Lookup map: ${setByMatchup.size} entries\n`);

  // ── Fetch pages ──
  const PAGES = [
    'Capcom_Cup/11/Group_Stage',
    'Capcom_Cup/11/Bracket',
  ];

  const allMatches = [];

  for (let i = 0; i < PAGES.length; i++) {
    if (i > 0) {
      console.log(`⏳ Waiting ${PARSE_DELAY_MS / 1000}s (Liquipedia rate limit)...`);
      await sleep(PARSE_DELAY_MS);
    }

    const page = PAGES[i];
    console.log(`🌐 Fetching: ${page}`);
    let wt;
    try {
      wt = await fetchWikitext(page);
    } catch (err) {
      console.log(`   ❌ ${err.message}`);
      continue;
    }
    console.log(`   ✅ ${wt.length} chars`);

    const matches = parseMatches(wt);
    console.log(`   Parsed ${matches.length} matches`);

    // Preview first 3
    matches.slice(0, 3).forEach(m => {
      console.log(`   [preview] ${m.p1}(${m.p1char ?? '?'}) ${m.p1wins}-${m.p2wins} ${m.p2}(${m.p2char ?? '?'})`);
    });

    allMatches.push(...matches);
  }

  console.log(`\n📊 Total matches parsed: ${allMatches.length}\n`);

  // ── Match to DB sets and build updates ──
  const updates = [];
  let noChar = 0, notFound = 0;

  for (const wm of allMatches) {
    const p1Lower = resolveHandle(wm.p1, playerByHandle);
    const p2Lower = resolveHandle(wm.p2, playerByHandle);

    // Determine winner/loser from wiki data
    let winHandle, loseHandle, winChar, loseChar;
    if (wm.p1wins > wm.p2wins) {
      winHandle = p1Lower; loseHandle = p2Lower;
      winChar = wm.p1char; loseChar = wm.p2char;
    } else {
      winHandle = p2Lower; loseHandle = p1Lower;
      winChar = wm.p2char; loseChar = wm.p1char;
    }

    const set = setByMatchup.get(`${winHandle}|${loseHandle}`);
    if (!set) {
      // Try reversed (in case DB winner/loser differs from wiki)
      const altSet = setByMatchup.get(`${loseHandle}|${winHandle}`);
      if (altSet) {
        // Flip chars accordingly
        updates.push({ id: altSet.id, winner_character: loseChar, loser_character: winChar });
        continue;
      }
      console.log(`   ⚠️  Not found: ${wm.p1} vs ${wm.p2}`);
      notFound++;
      continue;
    }

    if (!winChar && !loseChar) { noChar++; continue; }

    updates.push({ id: set.id, winner_character: winChar, loser_character: loseChar });
  }

  console.log(`✅ Matched: ${updates.length}`);
  console.log(`⚠️  No char data: ${noChar}`);
  console.log(`❌ Not in DB: ${notFound}\n`);

  // Preview updates
  console.log('=== Sample updates (first 5) ===');
  updates.slice(0, 5).forEach(u => {
    const s = sets.find(s => s.id === u.id);
    const w = s ? playerById.get(s.winner_id) : '?';
    const l = s ? playerById.get(s.loser_id)  : '?';
    console.log(`  set ${u.id}: ${w}(${u.winner_character ?? '-'}) beat ${l}(${u.loser_character ?? '-'})`);
  });

  if (DRY_RUN) {
    console.log('\n[dry-run] No DB writes. Remove --dry-run to apply.');
    return;
  }

  // ── Apply updates ──
  console.log(`\n💾 Applying ${updates.length} updates...`);
  let updated = 0, errors = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('tournament_sets')
      .update({ winner_character: u.winner_character, loser_character: u.loser_character })
      .eq('id', u.id);
    if (error) { console.log(`   ⚠️  id=${u.id}: ${error.message}`); errors++; }
    else updated++;
  }

  console.log(`\n✅ Done! Updated ${updated} sets. Errors: ${errors}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
