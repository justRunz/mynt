import type { FaceValueCents } from '@mynt/core'

import i18n from '../i18n'

/**
 * Formatting is where a language leaks without a single string to translate:
 * "0,02 €" in French against "€0.02" in English, and day/month order in dates.
 * Never build either by hand.
 */

const currencies = new Map<string, Intl.NumberFormat>()
const dates = new Map<string, Intl.DateTimeFormat>()

const locale = () => i18n.resolvedLanguage ?? 'fr'

export function formatFaceValue(cents: FaceValueCents | number): string {
  const loc = locale()
  let formatter = currencies.get(loc)
  if (!formatter) {
    formatter = new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: 'EUR',
      // Two decimals so 10 cents reads "0,10 €" and not "0,1 €", but stripped
      // when the value is a whole euro, so the 1 and 2 euro coins do not read
      // "1,00 €".
      minimumFractionDigits: 2,
      trailingZeroDisplay: 'stripIfInteger',
    })
    currencies.set(loc, formatter)
  }
  return formatter.format(cents / 100)
}

/** `date` is a Postgres `date`, i.e. an ISO YYYY-MM-DD string. */
export function formatDate(date: string): string {
  const loc = locale()
  let formatter = dates.get(loc)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(loc, { dateStyle: 'medium' })
    dates.set(loc, formatter)
  }
  return formatter.format(new Date(`${date}T00:00:00`))
}
