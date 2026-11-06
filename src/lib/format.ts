export const money = (amount: number, currency = '৳') =>
  `${currency}${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString('en-US')}`;

export const num = (value: number, digits = 0) =>
  (Number.isFinite(value) ? value : 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });

export const pct = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;

export const today = () => new Date().toISOString().slice(0, 10);

export const nowStamp = () => new Date().toISOString();

export const clock = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export const dateLabel = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const shortDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const monthLabel = (value: string) => {
  const [year, month] = value.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const isSameDay = (iso: string, day = today()) => {
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === day;
};

export const daysAgo = (count: number) => {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date.toISOString().slice(0, 10);
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

export const csv = (rows: (string | number)[][]) =>
  rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

export const download = (filename: string, content: string, type = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
