import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Applied to the wrapper, for sizing the field inside a flex row. */
  wrapperClassName?: string
  /** One step down the scale, for rows of metadata controls like the filters. */
  dense?: boolean
}

export function Field({
  label,
  wrapperClassName = '',
  className = '',
  dense = false,
  ...props
}: FieldProps) {
  const generated = useId()
  const id = props.id ?? generated

  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      <label htmlFor={id} className="text-sm font-[450] text-muted">
        {label}
      </label>
      {/* The reference draws inputs with a #ececec hairline. That measures
          1.18:1, and a border is what tells the eye this is a control at all,
          so border-field (3.24:1) stands in -- see the note in theme.css. */}
      <input
        id={id}
        className={`rounded-md border border-field bg-raised text-ink placeholder:text-subtle ${
          dense ? 'h-10 px-3 text-sm' : 'h-11 px-4 text-base'
        } ${className}`}
        {...props}
      />
    </div>
  )
}
