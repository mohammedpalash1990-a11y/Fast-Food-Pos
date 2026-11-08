/**
 * Pure helpers for the customer-facing QR menu (B7).
 *
 * The page is intentionally dependency free: it only needs the public
 * `GET /api/menu?branchId=...` payload, so the same data the POS login uses also
 * drives the menu a guest scans at the table. Keeping the shaping rules here
 * makes them testable without a browser.
 */

/** A product as returned by the public menu endpoint. */
export type PublicMenuProduct = {
  id?: unknown;
  name?: unknown;
  sku?: unknown;
  price?: unknown;
  image_url?: unknown;
  description?: unknown;
  category?: unknown;
};

export type PublicMenuBranch = {
  id: string;
  name: string;
  code?: string;
  organizationName?: string;
};

export type PublicMenuItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
};

export type MenuSection = { title: string; items: PublicMenuItem[] };

export type PublicMenuView = {
  branch: PublicMenuBranch;
  sections: MenuSection[];
  categories: string[];
  itemCount: number;
  generatedAt: string | null;
};

/** Products without a category are grouped here, and the group is shown last. */
export const UNCATEGORISED = 'Other items';

export type MenuQuery = { branchId: string | null; table: string | null };

/**
 * Read `?branch=<uuid>&table=<label>` from a query string. Values are trimmed,
 * length limited and never trusted beyond what the endpoint validates.
 */
export function parseMenuQuery(search: string): MenuQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const clean = (value: string | null, max: number): string | null => {
    const trimmed = (value ?? '').trim();
    return trimmed.length === 0 ? null : trimmed.slice(0, max);
  };
  return {
    branchId: clean(params.get('branch') ?? params.get('branchId'), 64),
    table: clean(params.get('table'), 24)
  };
}

/** Path for the public menu request; relative so no browser ever calls localhost. */
export function menuApiPath(branchId: string): string {
  return '/api/menu?branchId=' + encodeURIComponent(branchId);
}

/** Absolute link a printed QR code should point at. */
export function buildMenuShareUrl(origin: string, branchId: string, table?: string | null): string {
  const base = origin.replace(/\/$/, '') + '/menu';
  const params = new URLSearchParams({ branch: branchId });
  if (table) params.set('table', table);
  return base + '?' + params.toString();
}

/** SAR prices with thousands separators and exactly two decimals. */
export function formatSar(value: unknown): string {
  const parsed = Number(value);
  const amount = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  const [whole, decimals] = amount.toFixed(2).split('.');
  return 'SAR ' + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + decimals;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Group products into menu sections. Categories are alphabetical, the
 * uncategorised bucket is last, and items are alphabetical inside a section so
 * the printed/scan menu never reorders between refreshes.
 */
export function buildMenuSections(products: PublicMenuProduct[]): MenuSection[] {
  const sections = new Map<string, PublicMenuItem[]>();
  for (const product of products) {
    const name = toText(product.name);
    const id = toText(product.id);
    if (!name || !id) continue;
    const category = toText(product.category) || UNCATEGORISED;
    const price = Number(product.price);
    const item: PublicMenuItem = {
      id,
      name,
      price: Number.isFinite(price) ? Math.max(0, price) : 0,
      image: toText(product.image_url),
      description: toText(product.description),
      category
    };
    sections.set(category, [...(sections.get(category) ?? []), item]);
  }
  return Array.from(sections.entries())
    .map(([title, items]) => ({ title, items: items.slice().sort((left, right) => left.name.localeCompare(right.name)) }))
    .sort((left, right) => {
      if (left.title === UNCATEGORISED) return 1;
      if (right.title === UNCATEGORISED) return -1;
      return left.title.localeCompare(right.title);
    });
}

/**
 * Validate and shape a public menu response.
 * Throws a user-facing Error so the page can render a readable failure instead
 * of an empty grid.
 */
export function normaliseMenuPayload(raw: unknown): PublicMenuView {
  if (!raw || typeof raw !== 'object') throw new Error('The menu could not be loaded.');
  const payload = raw as { branch?: unknown; products?: unknown; generatedAt?: unknown };
  const branchRaw = (payload.branch ?? {}) as Record<string, unknown>;
  const branchId = toText(branchRaw.id);
  if (!branchId) throw new Error('This menu link is not valid. Please scan the QR code on your table again.');
  if (!Array.isArray(payload.products)) throw new Error('The menu could not be loaded.');
  const sections = buildMenuSections(payload.products as PublicMenuProduct[]);
  const itemCount = sections.reduce((total, section) => total + section.items.length, 0);
  return {
    branch: {
      id: branchId,
      name: toText(branchRaw.name) || 'Musafir Fast Food',
      code: toText(branchRaw.code) || undefined,
      organizationName: toText(branchRaw.organizationName) || undefined
    },
    sections,
    categories: sections.map(section => section.title),
    itemCount,
    generatedAt: toText(payload.generatedAt) || null
  };
}
