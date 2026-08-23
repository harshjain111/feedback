/**
 * Phone rules, with no dependencies.
 *
 * Separate from lib/validation.ts on purpose: that module imports zod, and the
 * kiosk's contact screen only needs these three functions. Importing the schema
 * module instead pulled zod into the kiosk bundle — 13kB of parser shipped to a
 * tablet to check ten digits, which §6 rules out.
 */

/** 10 digits, starting 6–9. Indian mobile numbering. */
export const INDIAN_MOBILE = /^[6-9]\d{9}$/

/** Strip spaces, dashes and a +91 / leading 0 before validating or storing. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/[^\d]/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function isValidPhone(input: string): boolean {
  return INDIAN_MOBILE.test(normalisePhone(input))
}

/** XXXXXX3210 — mirrors aic_mask_phone() in SQL (§11). */
export function maskPhone(phone: string | null, visibleDigits = 4): string | null {
  if (phone === null) return null
  if (phone.length <= visibleDigits) return 'X'.repeat(phone.length)
  return 'X'.repeat(phone.length - visibleDigits) + phone.slice(-visibleDigits)
}
