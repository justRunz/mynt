import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'quiet'

/**
 * Three levels: a filled button, a ghost that shares its geometry so the two
 * read as a matched pair on one baseline, and a plain text control for the
 * lowest-emphasis actions (sign out, dismiss) where the reference uses a bare
 * link rather than a button shape.
 *
 * The radius is the same --radius-md as inputs and selects, deliberately. The
 * reference makes buttons full-radius pills against 16px fields, and that
 * mismatch is the one part of it we do not keep: in a form, a control that
 * submits and a control that takes text belong to the same family and reading
 * them as two shapes on one row is noise. Everything round in this app is a
 * coin.
 *
 * Weight stays at 400. The dark fill carries the emphasis, so the label does
 * not need to.
 */
// Padding belongs to the variants, not here: base and variant both setting
// px-* is a conflict CSS resolves by source order rather than by the order the
// classes are written, so the quiet variant's px-2 silently lost to px-5.
const base =
  'inline-flex h-11 items-center justify-center gap-2 rounded-md text-base font-normal ' +
  'whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-ink px-5 text-surface hover:opacity-90',
  // border-current, not border-ink: a call site that recolours the label (the
  // delete action passes text-danger) gets a matching outline for free rather
  // than red text inside an ink ring.
  ghost: 'border border-current px-5 text-ink hover:bg-band',
  quiet: 'px-2 text-muted hover:text-ink',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}
