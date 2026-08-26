/** The eight circulating euro face values, in cents. */
export const FACE_VALUES_CENTS = [1, 2, 5, 10, 20, 50, 100, 200] as const

export type FaceValueCents = (typeof FACE_VALUES_CENTS)[number]

/**
 * Euro coins come in three metal families, and the mapping is fixed by the
 * mint. The UI leans on this: the completeness grid fills owned cells with the
 * matching metal, so the palette comes from the subject rather than a brand.
 */
export type MetalFamily = 'COPPER' | 'NORDIC_GOLD' | 'BIMETAL'

export function metalFamily(cents: FaceValueCents): MetalFamily {
  if (cents <= 5) return 'COPPER'
  if (cents <= 50) return 'NORDIC_GOLD'
  return 'BIMETAL'
}

export function isFaceValue(cents: number): cents is FaceValueCents {
  return (FACE_VALUES_CENTS as readonly number[]).includes(cents)
}
