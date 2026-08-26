import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function Field({ label, ...props }: FieldProps) {
  const generated = useId()
  const id = props.id ?? generated

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        className="h-10 rounded-md border border-rule bg-raised px-3 text-sm text-ink
                   placeholder:text-muted"
        {...props}
      />
    </div>
  )
}
