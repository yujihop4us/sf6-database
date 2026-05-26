'use client'

import { cc, V } from './tokens'

export function CharPill({ name, size = 12 }: { name?: string | null; size?: number }) {
  const color = cc(name)
  if (!name) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'rgba(0,0,0,0.45)', border: `1px solid ${color}55`,
      borderRadius: 4, padding: '2px 9px',
      fontFamily: V.FD, fontSize: size, fontWeight: 700,
      letterSpacing: '0.07em', textTransform: 'uppercase' as const, color,
    }}>{name}</span>
  )
}
