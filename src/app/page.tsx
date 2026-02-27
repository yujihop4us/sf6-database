import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function Home() {
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .order('total_sf6_earnings_usd', { ascending: false })
    .limit(25)

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-2">SF6 Database</h1>
      <p className="text-gray-400 mb-8">Street Fighter 6 Esports Stats & Prize Tracker</p>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4 text-yellow-400">
          💰 SF6 Earnings Rankings
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-left">
                <th className="p-3 w-12">#</th>
                <th className="p-3">Player</th>
                <th className="p-3">Country</th>
                <th className="p-3 text-right">Total Earnings</th>
              </tr>
            </thead>
            <tbody>
              {players?.map((player, i) => (
                <tr key={player.id} className="border-b border-gray-800 hover:bg-gray-900">
                  <td className="p-3 text-gray-500">{i + 1}</td>
                  <td className="p-3 font-bold">{player.handle}</td>
                  <td className="p-3">{player.country_code}</td>
                  <td className="p-3 text-right text-green-400">
                    ${Number(player.total_sf6_earnings_usd).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4 text-blue-400">
          🏆 Tournaments
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments?.map((t) => (
            <div key={t.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="font-bold text-lg">{t.name}</h3>
              <p className="text-gray-400 text-sm">{t.location}</p>
              <p className="text-gray-400 text-sm">
                {t.start_date} ~ {t.end_date}
              </p>
              {t.total_prize_usd && (
                <p className="text-yellow-400 font-bold mt-2">
                  Prize Pool: ${Number(t.total_prize_usd).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
