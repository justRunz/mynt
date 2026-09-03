import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'quiet'

/**
 * Three levels, matching the reference's own inventory: a filled pill, a ghost
 * pill that shares its geometry so the two read as a matched pair on one
 * baseline, and a plain text control for the lowest-emphasis actions (sign out,
 * dismiss) where the reference uses a bare link rather than a button shape.
 *
 * Weight stays at 400. The pill shape and the dark fill carry the emphasis, so
 * the label does not need to.
 */
const base =
  'inline-flex h-11 items-center justify-center rounded-full px-5 text-base font-normal ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:opacity-90',
  // border-current, not border-ink: a call site that recolours the label (the
  // delete action passes text-danger) gets a matching outline for free rather
  // than red text inside an ink ring.
  ghost: 'border border-current text-ink hover:bg-band',
  quiet: 'px-2 text-muted hover:text-ink',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}
