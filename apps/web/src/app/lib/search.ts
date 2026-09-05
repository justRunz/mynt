/**
 * Another spot where French hides outside of translatable strings: typing
 * "grece" has to find "Grèce", and "malte" has to find "Malte" regardless of
 * case. Intl.Collator compares whole strings and cannot do substring matching,
 * so fold the diacritics by hand.
 */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function matchesSearch(haystack: readonly (string | null)[], query: string): boolean {
  const needle = fold(query.trim())
  if (!needle) return true
  return haystack.some((value) => value !== null && fold(value).includes(needle))
}
