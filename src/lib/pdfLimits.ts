/** Shared PDF limits used by the browser reader, uploader and private cloud storage. */

/**
 * Chromium exposes a coarse deviceMemory estimate. Keep the normal 50 MB /
 * 400-page ceiling for capable devices, but use a safer profile on phones
 * reporting 2 GB RAM or less. Browsers that do not expose this hint keep the
 * standard limit; the value is a hint, not a precise hardware measurement.
 */
const deviceMemory = typeof navigator !== 'undefined'
  ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  : undefined

export const LOW_MEMORY_DEVICE = typeof deviceMemory === 'number' && deviceMemory <= 2
export const MAX_PAGES = LOW_MEMORY_DEVICE ? 150 : 400
export const MAX_PDF_BYTES = LOW_MEMORY_DEVICE ? 20 * 1024 * 1024 : 50 * 1024 * 1024
export const MAX_PDF_SIZE_LABEL = LOW_MEMORY_DEVICE ? '20 MB on this device' : '50 MB'
