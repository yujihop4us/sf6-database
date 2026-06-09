'use client'

import { V, type Player } from './tokens'
import { LiveChat } from './LiveChat'

export function SidePanelLeft({
  twitchChatChannels,
  isDemo,
}: {
  player1: Player | null
  player2: Player | null
  twitchChatChannels?: string[]
  isDemo?: boolean
}) {
  return (
    <div className="live-chat-panel" style={{
      background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10,
      overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      {/* ヘッダー */}
      <div style={{
        background: V.surface2, borderBottom: `1px solid ${V.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: V.FD, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase' as const,
          color: isDemo ? V.dim : V.accent,
        }}>💬 LIVE CHAT</div>
      </div>
      {/* チャット本体: flex-fill で残り高さを全て使う */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isDemo ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '20px', color: V.dim, fontFamily: V.FD, fontSize: 12,
            letterSpacing: '0.06em', textAlign: 'center' as const,
          }}>
            <span style={{ fontSize: 24 }}>💬</span>
            <span>DEMO MODE</span>
            <span style={{ fontSize: 10, color: `${V.dim}88` }}>本番ではTwitchチャットが表示されます</span>
          </div>
        ) : (
          <LiveChat twitchChatChannels={twitchChatChannels} fillHeight />
        )}
      </div>
    </div>
  )
}
