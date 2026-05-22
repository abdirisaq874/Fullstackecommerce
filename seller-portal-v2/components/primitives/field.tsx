import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';

export const inputClass = 'w-full px-3 py-2 bg-white border border-stone-200 rounded-md text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 transition-colors';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => <input ref={ref} className={clsx(inputClass, className)} {...rest} />
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...rest }, ref) => <textarea ref={ref} rows={rows} className={clsx(inputClass, className)} {...rest} />
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...rest }, ref) => <select ref={ref} className={clsx(inputClass, className)} {...rest}>{children}</select>
);
Select.displayName = 'Select';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-stone-800 mb-1.5">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {error
        ? <div className="text-xs text-red-600 mt-1">{error}</div>
        : hint ? <div className="text-xs text-stone-500 mt-1">{hint}</div> : null}
    </div>
  );
}
