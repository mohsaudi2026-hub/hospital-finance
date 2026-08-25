import React from 'react'

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  required?: boolean
  hint?: string
}

export function FormField({
  label,
  error,
  required,
  hint,
  id,
  className = '',
  ...props
}: FormFieldProps) {
  const inputId = id || label.replace(/\s+/g, '-').toLowerCase()

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="form-label">
        {label}
        {required && <span className="required">*</span>}
      </label>
      <input
        id={inputId}
        className={`form-input ${error ? 'error' : ''} ${className}`}
        required={required}
        {...props}
      />
      {hint && !error && <p className="text-xs text-[var(--color-muted)]">{hint}</p>}
      {error && (
        <p className="form-error">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  )
}
