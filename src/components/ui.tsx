import { type ReactNode, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export const panel = 'rounded-2xl border border-white/[.07] bg-white/[.022]';
export const inputCls =
  'w-full rounded-xl border border-white/[.09] bg-[#101418] px-3 py-2 text-[12.5px] text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-[#e7b943]/50 focus:ring-2 focus:ring-[#e7b943]/10';
export const selectCls = `${inputCls} appearance-none pr-8 cursor-pointer`;
export const textareaCls = `${inputCls} min-h-[76px] resize-y`;
export const labelCls = 'mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[.14em] text-slate-500';

export function Labeled({
  label,
  hint,
  children,
  className
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10.5px] text-slate-600">{hint}</span> : null}
    </label>
  );
}

export function Select({
  value,
  onChange,
  options,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={event => onChange(event.target.value)} className={cx(selectCls, className)}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

type BadgeTone = 'gold' | 'green' | 'red' | 'blue' | 'slate' | 'amber' | 'violet';

const badgeTones: Record<BadgeTone, string> = {
  gold: 'border-[#e7b943]/25 bg-[#e7b943]/10 text-[#f0cd75]',
  green: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  red: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  blue: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  slate: 'border-white/10 bg-white/[.04] text-slate-400',
  amber: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  violet: 'border-violet-400/25 bg-violet-400/10 text-violet-300'
};

export function Badge({ children, tone = 'slate', className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-medium',
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export const statusTone = (status: string): BadgeTone => {
  switch (status) {
    case 'Completed':
    case 'Paid':
    case 'Present':
    case 'Delivered':
    case 'Available':
    case 'received':
    case 'Active':
    case 'Confirmed':
      return 'green';
    case 'Pending':
    case 'Preparing':
    case 'Late':
    case 'Cleaning':
    case 'Assigned':
      return 'amber';
    case 'Accepted':
    case 'Ready':
    case 'Reserved':
    case 'Picked Up':
    case 'Seated':
      return 'blue';
    case 'Cancelled':
    case 'Absent':
    case 'Occupied':
      return 'red';
    case 'On Leave':
      return 'violet';
    default:
      return 'slate';
  }
};

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'soft';

export function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  type = 'button',
  disabled,
  title,
  size = 'md'
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  title?: string;
  size?: 'sm' | 'md';
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-gradient-to-b from-[#f1cb6b] to-[#d9a63a] text-[#241a06] shadow-[0_6px_18px_-8px_rgba(231,185,67,.6)] hover:from-[#f6d581] hover:to-[#e2af44]',
    outline: 'border border-white/12 bg-transparent text-slate-200 hover:border-white/25 hover:bg-white/[.04]',
    ghost: 'text-slate-400 hover:bg-white/[.05] hover:text-slate-100',
    danger: 'border border-rose-400/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
    soft: 'border border-[#e7b943]/20 bg-[#e7b943]/10 text-[#f0cd75] hover:bg-[#e7b943]/16'
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'px-2.5 py-1.5 text-[11.5px]' : 'px-3.5 py-2 text-[12.5px]',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  title,
  tone = 'ghost'
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  tone?: 'ghost' | 'danger' | 'gold';
}) {
  const tones = {
    ghost: 'text-slate-500 hover:bg-white/[.06] hover:text-slate-200',
    danger: 'text-rose-400/70 hover:bg-rose-500/10 hover:text-rose-300',
    gold: 'text-[#e7b943] hover:bg-[#e7b943]/10'
  };
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={cx('grid h-7 w-7 place-items-center rounded-lg transition', tones[tone])}>
      {children}
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <div className="mb-1 text-[10px] font-semibold uppercase tracking-[.24em] text-[#cba84c]">{eyebrow}</div> : null}
        <h1 className="font-serif text-[26px] leading-tight text-white md:text-[30px]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-[12.5px] text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(panel, 'p-5', className)}>{children}</div>;
}

export function CardTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[13.5px] font-semibold text-slate-100">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'gold'
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'gold' | 'green' | 'blue' | 'red' | 'violet' | 'amber';
}) {
  const tones = {
    gold: 'text-[#e7b943] bg-[#e7b943]/10 border-[#e7b943]/20',
    green: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    blue: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
    red: 'text-rose-300 bg-rose-400/10 border-rose-400/20',
    violet: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
    amber: 'text-amber-300 bg-amber-400/10 border-amber-400/20'
  };
  return (
    <div className={cx(panel, 'p-4')}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{label}</div>
        {icon ? <div className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg border', tones[tone])}>{icon}</div> : null}
      </div>
      <div className="mt-2.5 font-serif text-[22px] leading-none text-white">{value}</div>
      {hint ? <div className="mt-2 text-[10.5px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm md:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'my-auto w-full rounded-2xl border border-white/[.09] bg-[#12161a] shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]',
          wide ? 'max-w-4xl' : 'max-w-lg'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[.07] px-5 py-4">
          <div>
            <h2 className="font-serif text-[19px] text-white">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[11.5px] text-slate-500">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 custom-scrollbar">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-white/[.07] px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cx('relative', className)}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={cx(inputCls, 'pl-8')} />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-white/[.07] bg-black/20 p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cx(
            'rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition',
            value === option.value ? 'bg-[#e7b943] text-[#231a08]' : 'text-slate-400 hover:bg-white/[.05] hover:text-slate-200'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render: (row: T, index: number) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = 'No records yet',
  dense,
  onRowClick
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  dense?: boolean;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[.07]">
            {columns.map(column => (
              <th
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                className={cx(
                  'whitespace-nowrap px-3 py-2.5 text-[9.5px] font-semibold uppercase tracking-[.14em] text-slate-500',
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-[12px] text-slate-600">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  'border-b border-white/[.045] transition last:border-0 hover:bg-white/[.028]',
                  onRowClick ? 'cursor-pointer' : ''
                )}
              >
                {columns.map(column => (
                  <td
                    key={column.key}
                    className={cx(
                      'px-3 text-[12px] text-slate-300',
                      dense ? 'py-2' : 'py-2.5',
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''
                    )}
                  >
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 py-9 text-center">
      <div className="text-[13px] font-medium text-slate-300">{title}</div>
      {description ? <div className="mt-1 max-w-sm text-[11.5px] text-slate-500">{description}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Bar({ value, max, tone = 'gold' }: { value: number; max: number; tone?: 'gold' | 'green' | 'red' | 'blue' }) {
  const tones = { gold: 'bg-[#e7b943]', green: 'bg-emerald-400', red: 'bg-rose-400', blue: 'bg-sky-400' };
  const width = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[.07]">
      <div className={cx('h-full rounded-full transition-all', tones[tone])} style={{ width: `${width}%` }} />
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="my-3 h-px bg-white/[.07]" />;
  return (
    <div className="my-3 flex items-center gap-2">
      <div className="h-px flex-1 bg-white/[.07]" />
      <span className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-600">{label}</span>
      <div className="h-px flex-1 bg-white/[.07]" />
    </div>
  );
}
