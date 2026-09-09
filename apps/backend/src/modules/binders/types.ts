import type { z } from 'zod'

import type { createBinderSchema, createPageSchema } from './schemas.js'

/** A sheet in a binder: its dimensions are what the slot grid is drawn from. */
export interface BinderPage {
  pageId: string
  pageNumber: number
  rowCount: number
  columnCount: number
}

/** A binder with its sheets, in the shape the binder view draws. */
export interface Binder {
  binderId: string
  name: string
  pages: BinderPage[]
}

/** Inferred from the validators, so there is one description of a request body
 *  and it is the one that actually rejects things. */
export type CreateBinder = z.infer<typeof createBinderSchema>
export type CreatePage = z.infer<typeof createPageSchema>
