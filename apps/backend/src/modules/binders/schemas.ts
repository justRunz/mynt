import { z } from 'zod'

/**
 * The shape of every write to the binders.
 *
 * No owner anywhere: a binder belongs to whoever the token says is asking, and a
 * page belongs to its binder. Neither is something a request gets to state.
 */

export const createBinderSchema = z.object({
  // Trimmed, so a name that is only spaces is empty and refused rather than
  // stored as a binder nobody can point at in a list.
  name: z.string().trim().min(1).max(100),
})

export const createPageSchema = z.object({
  pageNumber: z.int().min(1).max(500),
  // Twenty is beyond the largest sheet sold. The tight bound is not a rule about
  // sheets, it is a bound on what a request may allocate: nothing here should be
  // able to ask for a page of a million holes.
  rowCount: z.int().min(1).max(20),
  columnCount: z.int().min(1).max(20),
})

export const binderIdSchema = z.object({ binderId: z.uuid() })
