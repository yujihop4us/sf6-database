'use client'

import { V } from './tokens'

export function CountdownDisplay({
  countdown, streamStartTime, configName, streamChannel,
}: {
  countdown: string
  streamStartTime?: string
  configName: string
  streamChannel: string | null
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(160deg, #050810 0%, #0a0e1a 60%, #060c18 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 18,
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400, height: 200,
        background: `radial-gradient(ellipse, ${V.accent}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* 大会名 */}
      <div style={{
        position: 'relative',
        fontFamily: V.FD, fontSize: 12, fontWeight: 700,
        letterSpacing: '0.22em', textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.35)',
      }}>{configName}</div>

      {/* カウントダウン or Coming Soon */}
      <div style={{ position: 'relative', textAlign: 'center' }}>
        {countdown ? (
          <>
            <div style={{
              fontFamily: V.FD, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.18em', textTransform: 'uppercase' as const,
              color: 'rgba(255,255,255,0.25)', marginBottom: 8,
            }}>配信開始まで</div>
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 'clamp(26px, 4.5vw, 50px)', fontWeight: 700,
              color: '#ffffff', letterSpacing: '0.08em',
              textShadow: `0 0 32px ${V.accent}55`,
            }}>{countdown}</div>
          </>
        ) : streamStartTime ? (
          <div style={{ fontFamily: V.FD, fontSize: 18, fontWeight: 700, color: V.accent, letterSpacing: '0.08em' }}>
            配信開始間近...
          </div>
        ) : (
          <div style={{ fontFamily: V.FD, fontSize: 15, color: V.muted, letterSpacing: '0.1em' }}>
            配信開始時刻 — COMING SOON
          </div>
        )}
      </div>

      {/* チャンネルリンク */}
      {streamChannel && (
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{
            fontFamily: V.FD, fontSize: 10, color: 'rgba(255,255,255,0.22)',
            letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 5,
          }}>配信チャンネル</div>
          <a href={`https://twitch.tv/${streamChannel}`} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: V.FD, fontSize: 13, fontWeight: 700, color: V.accent, letterSpacing: '0.06em', textDecoration: 'none' }}>
            twitch.tv/{streamChannel}
          </a>
        </div>
      )}
    </div>
  )
}
