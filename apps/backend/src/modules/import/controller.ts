import type { Request, Response } from 'express'

import { AiBusyError, extractCoins } from './extraction.js'
import { getExtractor } from './providers/index.js'
import { analyzeSchema } from './schemas.js'

/**
 * Reads an uploaded file and proposes coins. Nothing is saved: the collector
 * reviews the proposals, and only what they confirm goes to /collection/bulk.
 */
export async function analyze(req: Request, res: Response): Promise<void> {
  const file = analyzeSchema.parse(req.body)

  const extractor = getExtractor()
  if (!extractor) {
    res.status(503).json({ error: 'import_unavailable' })
    return
  }

  try {
    res.json(await extractCoins(extractor, file))
  } catch (error) {
    // A timeout (AbortSignal.timeout) counts as busy too: the model was too
    // slow, not wrong.
    if (error instanceof AiBusyError || (error instanceof Error && error.name === 'TimeoutError')) {
      res.status(503).json({ error: 'ai_busy' })
      return
    }
    // The provider's failure is not the caller's and not a bug here, so it is
    // logged and answered as a bad gateway, with nothing of its message.
    console.error('import analysis failed', error)
    res.status(502).json({ error: 'analysis_failed' })
  }
}
