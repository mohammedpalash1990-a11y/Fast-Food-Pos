import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatSar, menuApiPath, normaliseMenuPayload, parseMenuQuery, UNCATEGORISED, type PublicMenuView
} from './menu-model';

/**
 * Customer-facing QR menu (B7).
 *
 * Read-only by design: this POS has no payment gateway and no online ordering
 * contract, so the page shows the live branch menu and asks the guest to order
 * at the counter. It reads the public `GET /api/menu` endpoint over a relative
 * URL, which Vite proxies in development and the deployed host serves in
 * production.
 */

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BRAND = 'Musafir';

type LoadState = { status: 'loading' } | { status: 'ready'; menu: PublicMenuView } | { status: 'error'; message: string };

function errorMessage(status: number): string {
  if (status === 400) return 'This menu link is missing a valid branch. Please scan the QR code on your table again.';
  if (status === 404) return 'This branch menu is not available yet. Please ask a member of our team.';
  if (status === 429) return 'Too many menu requests right now. Please wait a moment and refresh.';
  return 'The menu could not be loaded. Please check your connection and try again.';
}

function PriceChip({ value }: { value: unknown }) {
  return (
    <span className="shrink-0 rounded-full border border-[#e7b943]/30 bg-[#e7b943]/10 px-3 py-1 text-sm font-semibold text-[#f1d178]">
      {formatSar(value)}
    </span>
  );
}

function Thumb({ name, image }: { name: string; image: string }) {
  if (image) {
    return <img src={image} alt={name} loading="lazy" className="h-32 w-full object-cover" />;
  }
  return (
    <div aria-hidden="true" className="grid h-32 w-full place-items-center bg-gradient-to-br from-[#1b2126] via-[#141a1f] to-[#0e1114]">
      <span className="font-serif text-3xl font-black text-[#e7b943]/25">{name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

export default function PublicMenu() {
  const query = useMemo(() => parseMenuQuery(window.location.search), []);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!query.branchId) {
      setState({ status: 'error', message: 'This page needs the QR code from your table so it can show the right branch menu.' });
      return;
    }
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}${menuApiPath(query.branchId)}`, {
        headers: { Accept: 'application/json' },
        signal
      });
      if (!response.ok) {
        setState({ status: 'error', message: errorMessage(response.status) });
        return;
      }
      const payload = await response.json();
      setState({ status: 'ready', menu: normaliseMenuPayload(payload) });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      setState({ status: 'error', message: error instanceof Error && error.message ? error.message : errorMessage(0) });
    } finally {
      setRefreshing(false);
    }
  }, [query.branchId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const visibleSections = useMemo(() => {
    if (state.status !== 'ready') return [];
    if (!activeCategory) return state.menu.sections;
    return state.menu.sections.filter(section => section.title === activeCategory);
  }, [state, activeCategory]);

  const menu = state.status === 'ready' ? state.menu : null;

  return (
    <div className="min-h-screen bg-[#0e1114] text-slate-100">
      <header className="border-b border-white/[.06] bg-[#111519]/95">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-5 sm:px-8">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#f0ca69] to-[#b37a18] font-serif text-xl font-black text-[#201707]">
            {BRAND.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-bold tracking-wide text-white sm:text-xl">
              {menu?.branch.organizationName || `${BRAND} Fast Food`}
            </h1>
            <p className="text-[10px] uppercase tracking-[.28em] text-[#cba84c]">
              {menu?.branch.name || 'Digital menu'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {query.table && (
              <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-xs text-slate-300">
                Table {query.table}
              </span>
            )}
            <button
              type="button"
              onClick={() => void load()}
              disabled={refreshing}
              className="rounded-full border border-[#e7b943]/40 px-3 py-1 text-xs font-semibold text-[#e7b943] transition hover:bg-[#e7b943]/10 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        {state.status === 'loading' && (
          <div aria-live="polite" aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-2xl border border-white/[.06] bg-white/[.03]" />
            ))}
          </div>
        )}

        {state.status === 'error' && (
          <section aria-live="polite" className="mx-auto max-w-lg rounded-2xl border border-rose-300/20 bg-rose-400/[.06] p-6 text-center">
            <h2 className="font-semibold text-white">Menu unavailable</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{state.message}</p>
            {query.branchId && (
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 rounded-xl border border-[#e7b943]/40 px-4 py-2 text-sm font-semibold text-[#e7b943] hover:bg-[#e7b943]/10"
              >
                Try again
              </button>
            )}
          </section>
        )}

        {menu && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                aria-pressed={activeCategory === null}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeCategory === null ? 'bg-[#e7b943] text-[#211908]' : 'border border-white/10 bg-white/[.03] text-slate-300 hover:text-white'}`}
              >
                All items
              </button>
              {menu.categories.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  aria-pressed={activeCategory === category}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeCategory === category ? 'bg-[#e7b943] text-[#211908]' : 'border border-white/10 bg-white/[.03] text-slate-300 hover:text-white'}`}
                >
                  {category}
                </button>
              ))}
            </div>

            {menu.itemCount === 0 ? (
              <p className="rounded-2xl border border-white/[.06] bg-white/[.02] p-10 text-center text-sm text-slate-400">
                This branch has no active menu items right now. Please ask our team for today&apos;s selection.
              </p>
            ) : (
              <div className="space-y-8">
                {visibleSections.map(section => (
                  <section key={section.title} aria-labelledby={`section-${section.title.replace(/\s+/g, '-').toLowerCase()}`}>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <h2
                        id={`section-${section.title.replace(/\s+/g, '-').toLowerCase()}`}
                        className="font-serif text-lg font-semibold text-white"
                      >
                        {section.title}
                      </h2>
                      <span className="text-[11px] uppercase tracking-[.2em] text-slate-500">
                        {section.items.length} {section.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {section.items.map(item => (
                        <article key={item.id} className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#141a1f] shadow-soft">
                          <Thumb name={item.name} image={item.image} />
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-sm font-semibold leading-5 text-white">{item.name}</h3>
                              <PriceChip value={item.price} />
                            </div>
                            {item.description && (
                              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.description}</p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
                {!visibleSections.length && (
                  <p className="rounded-2xl border border-white/[.06] bg-white/[.02] p-10 text-center text-sm text-slate-400">
                    Nothing in {activeCategory === UNCATEGORISED ? 'this section' : activeCategory} right now.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-5 pb-10 sm:px-8">
        <div className="rounded-2xl border border-white/[.06] bg-white/[.02] p-5 text-xs leading-5 text-slate-400">
          <p className="font-semibold text-slate-200">Ordering &amp; payment</p>
          <p className="mt-1">
            This menu is for browsing. Please place your order with our counter team; we accept <strong className="text-slate-200">Cash</strong> and{' '}
            <strong className="text-slate-200">Mada</strong> only.
          </p>
          <p className="mt-2">All prices are shown in Saudi Riyal (SAR). Recorded VAT is added at checkout.</p>
        </div>
      </footer>
    </div>
  );
}
