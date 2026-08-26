import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost'

const base =
  'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:opacity-90',
  ghost: 'text-muted hover:text-ink',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}
