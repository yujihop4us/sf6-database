'use client'

import { useState, useEffect, useRef } from 'react'
import { V } from './tokens'

const INIT_CHAT = [
  { id: 1, user: 'sf6_fan',    color: '#10b981', msg: '試合開始！' },
  { id: 2, user: 'evo_viewer', color: '#3b82f6', msg: '今日の試合楽しみ' },
  { id: 3, user: 'hadouken',   color: '#f5a623', msg: '選手を選択してH2Hを確認しよう' },
  { id: 4, user: 'capcom_pro', color: '#2e9e5b', msg: 'ブラケット確認中' },
  { id: 5, user: 'tokyoFC',    color: '#ec4899', msg: 'よろしくお願いします！' },
]

export function LiveChat({
  twitchChatChannels,
  fillHeight = false,
}: {
  twitchChatChannels?: string[]
  fillHeight?: boolean
}) {
  const [selectedIdx, setSelectedIdx]   = useState(0)
  const [messages, setMessages]         = useState(INIT_CHAT)
  const [input, setInput]               = useState('')
  const bottomRef                       = useRef<HTMLDivElement>(null)
  const idRef                           = useRef(6)

  // ── Twitch chat iframe mode ──────────────────────────────────────────────
  if (twitchChatChannels && twitchChatChannels.length > 0) {
    const channel = twitchChatChannels[selectedIdx] ?? twitchChatChannels[0]
    return (
      // fillHeight=true: 親の flex-fill に合わせて伸縮。false: 固定 420px (後方互換)
      <div style={{
        display: 'flex', flexDirection: 'column',
        ...(fillHeight ? { flex: 1, minHeight: 0 } : { height: 420 }),
      }}>
        {/* チャンネル切り替え (複数ある場合) */}
        {twitchChatChannels.length > 1 && (
          <div style={{
            display: 'flex', gap: 4, padding: '6px 10px',
            borderBottom: `1px solid ${V.border}`, background: V.surface2,
            flexWrap: 'wrap' as const, flexShrink: 0,
          }}>
            {twitchChatChannels.map((ch, i) => (
              <button key={ch} onClick={() => setSelectedIdx(i)} style={{
                background: selectedIdx === i ? V.surface3 : 'transparent',
                border: `1px solid ${selectedIdx === i ? V.accent + '50' : V.border}`,
                borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                fontFamily: V.FD, fontSize: 11, fontWeight: 700,
                color: selectedIdx === i ? V.accent : V.muted,
              }}>{ch}</button>
            ))}
          </div>
        )}
        {/* iframe を overflow:hidden でラップしてチャット入力欄を隠す
            Twitch の darkpopout では:
              下部 ~52px = chat input box (display-only では不要)
              上部 ~1px  = border
            ランキング・お知らせは Twitch 側 UI のため公式パラメータでは非表示不可。
            もし上部バナーが邪魔な場合は marginTop: -56 + height calc を追加 */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <iframe
            key={channel}
            src={`https://www.twitch.tv/embed/${channel}/chat?parent=localhost&parent=sf6-database.vercel.app&darkpopout`}
            style={{
              border: 'none', width: '100%',
              // 親より 52px 背高く stretch → 下部の chat input が clipping で隠れる
              height: 'calc(100% + 52px)',
              display: 'block',
            }}
            title={`Twitch chat: ${channel}`}
            allowFullScreen
          />
        </div>
      </div>
    )
  }

  // ── Fallback: モックチャット ──────────────────────────────────────────────
  useEffect(() => {
    if (bottomRef.current?.parentElement) {
      bottomRef.current.parentElement.scrollTop = bottomRef.current.parentElement.scrollHeight
    }
  }, [messages])

  const send = () => {
    if (!input.trim()) return
    const now  = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setMessages(prev => [...prev.slice(-40), {
      id: idRef.current++, user: 'あなた', color: V.accent,
      msg: input.trim(), time, isMe: true,
    } as any])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 260 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.map((m: any) => (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: V.FD, fontSize: 12, fontWeight: 700, color: m.color, flexShrink: 0, minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user}</span>
            <span style={{ fontFamily: V.FB, fontSize: 13, color: m.isMe ? V.accent : V.text, lineHeight: 1.4 }}>{m.msg}</span>
            {m.time && <span style={{ marginLeft: 'auto', fontFamily: V.FD, fontSize: 10, color: V.dim, flexShrink: 0 }}>{m.time}</span>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ borderTop: `1px solid ${V.border}`, padding: '10px 14px', display: 'flex', gap: 8 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="コメントを入力..."
          style={{
            flex: 1, background: V.surface3, border: `1px solid ${V.border}`,
            borderRadius: 6, padding: '7px 12px',
            color: V.text, fontFamily: V.FB, fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={send} style={{
          background: V.accent, border: 'none', borderRadius: 6,
          padding: '7px 14px', cursor: 'pointer',
          fontFamily: V.FD, fontSize: 12, fontWeight: 800,
          letterSpacing: '0.06em', color: '#000',
        }}>送信</button>
      </div>
    </div>
  )
}
