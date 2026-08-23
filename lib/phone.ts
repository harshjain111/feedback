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

/**
 * Whether KEEP ME CONNECTED on the contact screen has anything to keep.
 *
 * A valid phone number is the whole condition, and a name deliberately is not
 * part of it. Guest resolution keys on the phone (§7): POST /api/feedback only
 * creates or attaches a guest when a number is present, so a name submitted
 * without one is discarded. Enabling the button for a name alone would tell the
 * guest they had connected while storing nothing.
 *
 * This gates one button, never the journey — SKIP sits beneath it, full size
 * and always live (§4).
 */
export function canKeepContact(phone: string): boolean {
  return phone.trim() !== '' && isValidPhone(phone)
}
