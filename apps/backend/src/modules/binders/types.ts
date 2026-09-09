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
