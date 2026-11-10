import { z } from 'zod'

/**
 * What the AI is asked, and what it is allowed to answer.
 *
 * Provider-agnostic on purpose: the prompt, the shape and the validation live
 * here, and a provider file only moves bytes to and from one vendor's API.
 * Swapping the vendor must never touch the rules about what a coin is.
 */

export const PROMPT = `You read a document -- a photo of coins, a PDF, a CSV or a text list -- and list the euro coins it shows.
Only euro coins. Ignore anything else.
For each distinct coin return:
- countryCode: ISO 3166 alpha-2, uppercase (for example FR, DE, IT).
- faceValueCents: one of 1, 2, 5, 10, 20, 50, 100, 200.
- year: four digits.
- quantity: at least 1. A row like "x3" means quantity 3.
- variant: what sets it apart from the ordinary coin (for example a commemorative description), or null.
- grade: the condition if stated, or null.
- note: anything else worth keeping, or null.
When something cannot be read with confidence, use null for that field rather than guessing -- for example a year that is not legible on a photo.`

/** A plain JSON Schema, so any provider can take it as is or adapt it. */
export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          countryCode: { type: ['string', 'null'] },
          faceValueCents: { type: ['integer', 'null'] },
          year: { type: ['integer', 'null'] },
          quantity: { type: 'integer', minimum: 1 },
          variant: { type: ['string', 'null'] },
          grade: { type: ['string', 'null'] },
          note: { type: ['string', 'null'] },
        },
        required: ['countryCode', 'faceValueCents', 'year', 'quantity', 'variant', 'grade', 'note'],
      },
    },
  },
  required: ['items'],
} as const

const itemSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/).nullable(),
  faceValueCents: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(5),
    z.literal(10),
    z.literal(20),
    z.literal(50),
    z.literal(100),
    z.literal(200),
  ]).nullable(),
  year: z.int().min(1999).max(2100).nullable(),
  quantity: z.int().min(1).max(10000),
  variant: z.string().max(300).nullable(),
  grade: z.string().max(40).nullable(),
  note: z.string().max(500).nullable(),
})

export type ExtractedCoin = z.infer<typeof itemSchema>
export type Extraction = { items: ExtractedCoin[] }

/** Whatever vendor sits behind it: a file in, the model's raw JSON out. */
export type CoinExtractor = (file: { mimeType: string; data: string }) => Promise<unknown>

const MAX_ITEMS = 500

/**
 * Asks the extractor, then trusts nothing it said.
 *
 * Lenient per item: a model that gets 40 coins right and one wrong should cost
 * the one, not the forty. But an answer that is not even { items: [...] } is a
 * failure of the whole call, and throws.
 */
export async function extractCoins(
  extractor: CoinExtractor,
  file: { mimeType: string; data: string },
): Promise<Extraction> {
  const raw = await extractor(file)
  const list = (raw as { items?: unknown } | null)?.items
  if (!Array.isArray(list)) throw new Error('extractor returned no items array')

  const items: ExtractedCoin[] = []
  for (const candidate of list) {
    const parsed = itemSchema.safeParse(candidate)
    if (parsed.success) items.push(parsed.data)
    if (items.length === MAX_ITEMS) break
  }
  return { items }
}

/**
 * The AI is up but cannot take the request right now -- overloaded, rate
 * limited or too slow. Every provider throws this for that case, so the caller
 * can say "try again in a moment" rather than "try another file".
 */
export class AiBusyError extends Error {}
