'use client';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const variants = {
  primary: 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] hover:brightness-110 text-white shadow-[0_12px_30px_rgba(0,52,111,0.18)]',
  secondary: 'bg-[var(--color-sidebar)] hover:bg-[#1d2839] text-white shadow-sm',
  outline: 'border border-[var(--color-border)] bg-white/60 hover:bg-[var(--color-surface-low)] text-[var(--color-text-muted)]',
  ghost: 'hover:bg-[var(--color-surface-high)] text-[var(--color-text-muted)]',
  danger: 'bg-[var(--color-danger)] hover:brightness-110 text-white shadow-sm',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold uppercase tracking-[0.14em] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
