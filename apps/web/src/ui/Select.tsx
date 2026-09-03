import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  /** One step down the scale, for rows of metadata controls like the filters. */
  dense?: boolean
}

/**
 * A native select. The searchable country combobox of the quick-add form needs
 * downshift, but a plain listbox of a dozen options does not: native is already
 * accessible, and it gets the platform picker on mobile for free.
 */
export function Select({ label, dense = false, children, ...props }: SelectProps) {
  const generated = useId()
  const id = props.id ?? generated

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-[450] text-muted">
        {label}
      </label>
      <select
        id={id}
        className={`rounded-md border border-field bg-raised text-ink ${
          dense ? 'h-10 px-2 text-sm' : 'h-11 px-3 text-base'
        }`}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
