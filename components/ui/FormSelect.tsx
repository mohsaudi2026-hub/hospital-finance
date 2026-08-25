import React from 'react'

interface Option {
  value: string
  label: string
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: Option[]
  placeholder?: string
  error?: string
  required?: boolean
  hint?: string
}

export function FormSelect({
  label,
  options,
  placeholder = '— اختر من القائمة —',
  error,
  required,
  hint,
  id,
  className = '',
  ...props
}: FormSelectProps) {
  const selectId = id || label.replace(/\s+/g, '-').toLowerCase()

  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="form-label">
        {label}
        {required && <span className="required">*</span>}
      </label>
      <select
        id={selectId}
        className={`form-input cursor-pointer ${error ? 'error' : ''} ${className}`}
        required={required}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error && <p className="text-xs text-[var(--color-muted)]">{hint}</p>}
      {error && (
        <p className="form-error">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  )
}
