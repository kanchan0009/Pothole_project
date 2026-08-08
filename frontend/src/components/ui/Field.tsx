import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Labeled form field with hint + validation message (uses the .input-field styles). */
export function Field({ label, error, hint, children }: FieldProps) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-primary/50">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/**
 * Field inputs are forwardRef so react-hook-form's `register()` ref callback
 * reaches the DOM node. Without it the ref is dropped and RHF never registers
 * the field — validation silently skips and submits send empty values.
 */
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = '', ...props }, ref) {
    return <input ref={ref} className={`input-field ${className}`} {...props} />;
  }
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className = '', rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={`input-field resize-y ${className}`} {...props} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', ...props }, ref) {
    return <select ref={ref} className={`input-field ${className}`} {...props} />;
  }
);
