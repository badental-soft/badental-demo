/**
 * Get current date string in Argentina timezone (UTC-3)
 * Returns YYYY-MM-DD format
 */
export function getArgentinaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

/**
 * Get current Date object adjusted to Argentina timezone
 */
export function getArgentinaDate(): Date {
  const now = new Date()
  const argStr = now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  return new Date(argStr)
}

/**
 * Format today's date in Spanish for display
 */
export function formatFechaHoyAR(): string {
  return new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
