import { z } from 'zod'

/**
 * Shared validation — CLAUDE.md §5, §7.
 *
 * The kiosk uses these for gentle inline feedback; POST /api/feedback uses them
 * as the real gate. Nothing here is ever `required` on the guest's side: phone
 * and name are optional always (§11), and validation only has an opinion once
 * the guest has actually typed something.
 */

/** 10 digits, starting 6–9. Indian mobile numbering. */
export const INDIAN_MOBILE = /^[6-9]\d{9}$/

/** Strip spaces, dashes and a +91 / 0 prefix before validating or storing. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/[^\d]/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function isValidPhone(input: string): boolean {
  return INDIAN_MOBILE.test(normalisePhone(input))
}

/** Empty is fine. Anything typed must be a real mobile number. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform(normalisePhone)
  .refine((value) => value === '' || INDIAN_MOBILE.test(value), {
    message: 'Enter a 10-digit mobile number',
  })

export const optionalNameSchema = z.string().trim().max(120)
