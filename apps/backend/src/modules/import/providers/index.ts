import { env } from '../../../env.js'
import type { CoinExtractor } from '../extraction.js'
import { geminiExtractor } from './gemini.js'

/** Adding a vendor is a file next to gemini.ts and a line here. */
const providers: Record<string, (apiKey: string, model?: string) => CoinExtractor> = {
  gemini: geminiExtractor,
}

// At load, not at the first upload: a typo in AI_PROVIDER should stop the
// server at start rather than surface as a failed import weeks later.
const factory = providers[env.aiProvider]
if (!factory) {
  throw new Error(
    `AI_PROVIDER "${env.aiProvider}" is unknown. Expected one of: ${Object.keys(providers).join(', ')}.`,
  )
}

const makeExtractor = factory

/** Null when no key is set: the import is then unavailable, not broken. */
export function getExtractor(): CoinExtractor | null {
  return env.aiApiKey ? makeExtractor(env.aiApiKey, env.aiModel) : null
}
