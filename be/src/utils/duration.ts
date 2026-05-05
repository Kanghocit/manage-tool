const unitToMs: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
}

export function parseDurationToMs(input: string): number {
  const value = input.trim()
  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(value)
  if (!match) {
    throw new Error(`Invalid duration: ${input}. Expected format like 15m, 7d, 1h.`)
  }

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const ms = amount * unitToMs[unit]

  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(`Invalid duration value: ${input}`)
  }

  return ms
}

