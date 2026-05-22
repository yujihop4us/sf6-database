import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 遅延初期化: ビルド時に環境変数が未設定でも import でクラッシュしない
let _client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin env vars not set')
  _client = createClient(url, key)
  return _client
}

// 後方互換: 既存コードが supabaseAdmin を直接参照している場合は
// Proxy 経由で遅延解決する
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop]
  },
})
