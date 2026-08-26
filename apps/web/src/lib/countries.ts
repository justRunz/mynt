import i18n from '../i18n'

/**
 * The country name is not stored in the database: it would be redundant and
 * lock the catalog to one language. The browser derives it from the ISO code,
 * in whatever locale the interface is currently running.
 */

const displayNames = new Map<string, Intl.DisplayNames>()
const collators = new Map<string, Intl.Collator>()

const locale = () => i18n.resolvedLanguage ?? 'fr'

function displayNamesFor(loc: string): Intl.DisplayNames {
  let existing = displayNames.get(loc)
  if (!existing) {
    existing = new Intl.DisplayNames([loc], { type: 'region' })
    displayNames.set(loc, existing)
  }
  return existing
}

export function countryName(code: string): string {
  const upper = code.toUpperCase()
  return displayNamesFor(locale()).of(upper) ?? upper
}

/** Regional indicator symbols, which render as the flag emoji. */
export function countryFlag(code: string): string {
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

/**
 * Sorting country names needs a locale-aware collator. Array.prototype.sort
 * compares code points, which would file "Éire" after "Zimbabwe" -- and the
 * country picker in the quick-add form is exactly where that would show.
 */
export function countryCollator(): Intl.Collator {
  const loc = locale()
  let existing = collators.get(loc)
  if (!existing) {
    existing = new Intl.Collator(loc, { sensitivity: 'base' })
    collators.set(loc, existing)
  }
  return existing
}

export function sortCountryCodes(codes: readonly string[]): string[] {
  const collator = countryCollator()
  return [...codes].sort((a, b) => collator.compare(countryName(a), countryName(b)))
}
