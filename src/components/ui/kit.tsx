import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, X } from 'lucide-react';

/* ---------------------------------------------------------------- Button --- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-[#1a1a1a] text-white hover:bg-black shadow-lg',
  secondary: 'bg-white/70 text-neutral-800 hover:bg-white border border-white/70 shadow-sm',
  ghost: 'bg-transparent text-neutral-600 hover:bg-black/[0.04]',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-lg',
};
export function Button({ variant = 'primary', loading, className = '', children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${buttonVariants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- Text field --- */
interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
}
export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-neutral-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-blue-300 focus:bg-white';

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => <input ref={ref} className={`${inputBase} ${className}`} {...props} />,
);
TextInput.displayName = 'TextInput';

/** Password field with a show/hide toggle. Same shape as TextInput. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input ref={ref} type={visible ? 'text' : 'password'} className={`${inputBase} pr-11 ${className}`} {...props} />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-400 hover:text-neutral-700"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea ref={ref} className={`${inputBase} min-h-[96px] resize-y ${className}`} {...props} />
  ),
);
TextArea.displayName = 'TextArea';

export function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputBase} appearance-none pr-10 ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-neutral-700">
      <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500" {...props} />
      {label}
    </label>
  );
}

/* -------------------------------------------------------------- Feedback --- */
export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue'; children: React.ReactNode }) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-600',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-neutral-500">
      <Loader2 className="animate-spin" size={18} /> {label ?? 'Loading…'}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[2rem] border border-white/60 bg-white/30 px-8 py-16 text-center">
      {icon && <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-blue-500 shadow-sm">{icon}</div>}
      <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-neutral-600">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`mt-16 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-neutral-400 hover:bg-black/[0.05] hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Toast --- */
type Toast = { id: number; message: string; tone: 'success' | 'error' };
const ToastCtx = createContext<(message: string, tone?: 'success' | 'error') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-xl ${
              t.tone === 'success' ? 'border-green-200 bg-green-50/90 text-green-800' : 'border-red-200 bg-red-50/90 text-red-800'
            }`}
          >
            {t.tone === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
