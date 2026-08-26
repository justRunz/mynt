import { uuidv7 } from 'uuidv7'

/**
 * Ids for binders, pages and coins are generated on the client, not by the
 * database. A coin entered in a cellar with no signal needs an id before it
 * ever reaches the server, and a page created offline has to be referenceable
 * by the coins filed into it without an id remapping layer.
 *
 * v7 rather than v4 so the ids stay roughly time-ordered and keep index
 * locality on insert.
 */
export const newId = (): string => uuidv7()
