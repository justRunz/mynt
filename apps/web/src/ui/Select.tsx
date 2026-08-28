import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
}

/**
 * A native select. The searchable country combobox of the quick-add form needs
 * Radix, but a plain listbox of a dozen options does not: native is already
 * accessible, and it gets the platform picker on mobile for free.
 */
export function Select({ label, children, ...props }: SelectProps) {
  const generated = useId()
  const id = props.id ?? generated

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <select
        id={id}
        className="h-9 rounded-md border border-field bg-raised px-2 text-sm text-ink"
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
