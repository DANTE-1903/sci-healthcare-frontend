'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { VoucherStatus } from '@/lib/api';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles = {
    primary:
      'bg-[var(--color-brand)] text-white hover:opacity-90 disabled:opacity-40',
    ghost:
      'border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-canvas)] disabled:opacity-40',
    danger: 'bg-[var(--color-danger)] text-white hover:opacity-90 disabled:opacity-40',
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex max-sm:min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<VoucherStatus, string> = {
  Funded: 'bg-blue-50 text-blue-700 ring-blue-200',
  Claimed: 'bg-amber-50 text-amber-800 ring-amber-200',
  Attested: 'bg-violet-50 text-violet-700 ring-violet-200',
  Settled: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Disputed: 'bg-red-50 text-red-700 ring-red-200',
  Refunded: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatusBadge({ status }: { status: VoucherStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
        {label}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export function Alert({
  kind = 'error',
  children,
}: {
  kind?: 'error' | 'info' | 'success';
  children: ReactNode;
}) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[kind];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-line)] px-6 py-12 text-center text-sm text-[var(--color-ink-soft)]">
      {children}
    </div>
  );
}

export function ExplorerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
    >
      {children}
    </Link>
  );
}

/**
 * Accessible modal dialog.
 *
 * - Focus moves into the dialog on open and returns to the trigger on close.
 * - `Escape` closes; Tab cycles inside (focus trap).
 * - Backdrop click closes. `aria-modal` + labelled title for screen readers.
 *
 * Built on a plain div + portal rather than `<dialog>` so styling and the
 * trap behave identically in every browser the wallet kit supports.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    const dialog = dialogRef.current;
    // Focus the dialog itself first so screen readers announce the title,
    // then the first control once the user tabs.
    dialog?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md px-2 py-1 text-lg leading-none text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
          >
            ×
          </button>
        </div>
        <div className="mt-3 text-sm">{children}</div>
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Accessible tooltip.
 *
 * Shows on hover *and* keyboard focus, hides on blur/Escape, and exposes
 * the hint via `aria-describedby` + `role="tooltip"` so screen readers
 * announce it. Use for short hints that would otherwise crowd the UI.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  const position =
    side === 'top'
      ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
      : 'top-full left-1/2 mt-2 -translate-x-1/2';

  return (
    <span className="relative inline-flex items-center">
      <span
        className="inline-flex items-center"
        aria-describedby={visible ? id : undefined}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setVisible(false);
        }}
      >
        {children}
      </span>
      {visible && (
        <span
          role="tooltip"
          id={id}
          className={`pointer-events-none absolute z-40 w-56 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-xs leading-relaxed text-white shadow-lg ${position}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/** Small "?" affordance that pairs with {@link Tooltip} for inline hints. */
export function InfoTip({ content }: { content: ReactNode }) {
  return (
    <Tooltip content={content}>
      <span
        tabIndex={0}
        aria-label="More information"
        className="ml-1 inline-grid h-4 w-4 cursor-help place-items-center rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)] text-[10px] leading-none text-[var(--color-ink-soft)]"
      >
        ?
      </span>
    </Tooltip>
  );
}
