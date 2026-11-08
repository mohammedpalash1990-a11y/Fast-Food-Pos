import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatSar, menuApiPath, normaliseMenuPayload, parseMenuQuery, type PublicMenuView
} from './menu-model';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\\/$/, '');
const BRAND = 'MUSAFIR';

type LoadState = { status: 'loading' } | { status: 'ready'; menu: PublicMenuView } | { status: 'error'; message: string };

function errorMessage(status: number): string {
  if (status === 400) return 'This menu link is incomplete. Scan the QR code again or ask our team for help.';
  if (status === 404) return 'This branch menu is not available yet. Please ask our team.';
  if (status === 429) return 'The menu is receiving too many requests. Wait a moment, then try again.';
  return 'We could not reach the menu. Check your connection and try again.';
}

function ProductImage({ name, image }: { name: string; image: string }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        loading="lazy"
        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
      />
    );
  }
  return (
    <div aria-label={name} className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_40%,#3a3020_0%,#201c17_45%,#151515_100%)]">
      <span aria-hidden="true" className="font-serif text-5xl italic text-[#d9b66b]/35">{name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

function ProductCard({ item }: { item: PublicMenuView['sections'][number]['items'][number] }) {
  return (
    <article className="group overflow-hidden rounded-[1.35rem] border border-[#e8dfcf] bg-[#fffdf8] shadow-[0_12px_35px_rgba(35,27,17,.055)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(35,27,17,.11)]">
      <div className="relative h-48 overflow-hidden bg-[#211e19] sm:h-52">
        <ProductImage name={item.name} image={item.image} />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-full border border-white/25 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-white backdrop-blur">
          {item.category}
        </span>
      </div>
      <div className="flex min-h-[112px] items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-semibold leading-tight text-[#211f1a]">{item.name}</h3>
          {item.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#777064]">{item.description}</p>}
        </div>
        <span className="shrink-0 rounded-xl bg-[#211f1a] px-3 py-2 text-xs font-bold tabular-nums text-[#f2d99e]">
          {formatSar(item.price)}
        </span>
      </div>
    </article>
  );
}

export default function PublicMenu() {
  const query = useMemo(() => parseMenuQuery(window.location.search), []);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!query.branchId) {
      setState({ status: 'error', message: 'This page needs the QR code from your branch so we can show the correct menu.' });
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
      setState({ status: 'ready', menu: normaliseMenuPayload(await response.json()) });
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

  const menu = state.status === 'ready' ? state.menu : null;
  const visibleSections = useMemo(() => {
    if (!menu) return [];
    const term = search.trim().toLocaleLowerCase();
    return menu.sections
      .filter(section => !activeCategory || section.title === activeCategory)
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          !term || item.name.toLocaleLowerCase().includes(term) ||
          item.description.toLocaleLowerCase().includes(term) ||
          item.category.toLocaleLowerCase().includes(term)
        )
      }))
      .filter(section => section.items.length > 0);
  }, [menu, activeCategory, search]);
  const visibleCount = visibleSections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="min-h-screen bg-[#f4f0e7] text-[#211f1a] selection:bg-[#d8b66b]/40">
      <header className="relative overflow-hidden bg-[#171916] text-[#f7f1e5]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 h-96 w-96 rounded-full border border-[#d8b66b]/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-[#d8b66b]/20" />
        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-5 sm:px-8 sm:pb-16">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center border border-[#d8b66b]/65 font-serif text-xl italic text-[#e8ca87]">M</div>
              <div>
                <p className="text-xs font-bold tracking-[.32em] text-white">{BRAND}</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-[.24em] text-[#b7aa8f]">Fast food · Saudi Arabia</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {query.table && <span className="rounded-full border border-[#d8b66b]/35 px-3 py-1.5 text-[10px] uppercase tracking-[.16em] text-[#e8ca87]">Table {query.table}</span>}
              <span className="hidden rounded-full bg-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[.16em] text-[#d7cfbf] sm:inline-flex">Digital menu</span>
            </div>
          </div>
          <div className="grid items-end gap-8 pt-10 sm:grid-cols-[1fr_auto] sm:pt-14">
            <div className="max-w-2xl">
              <p className="mb-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.3em] text-[#d8b66b]">
                <span className="h-px w-8 bg-[#d8b66b]" /> Made for good moments
              </p>
              <h1 className="font-serif text-5xl font-medium leading-[.98] tracking-[-.04em] sm:text-7xl">
                A little more<br /><span className="italic text-[#e2c27e]">crave-worthy.</span>
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-[#c6c0b3]">
                Explore the menu, find your favourites, and let the good food do the talking.
              </p>
            </div>
            <div className="hidden min-w-40 border-l border-[#d8b66b]/35 pl-5 pb-1 sm:block">
              <p className="text-[9px] uppercase tracking-[.25em] text-[#a99e89]">Now serving</p>
              <p className="mt-2 font-serif text-xl text-[#f2e5c8]">{menu?.branch.name || 'Your branch'}</p>
              <p className="mt-1 text-[10px] tracking-wide text-[#a99e89]">{menu?.itemCount ?? '—'} menu selections</p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-transparent via-[#d8b66b] to-transparent opacity-70" />
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-14 sm:px-8">
        {state.status === 'loading' && (
          <div aria-live="polite" aria-busy="true" className="grid gap-5 py-10 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-[1.35rem] bg-white/70" />)}
          </div>
        )}

        {state.status === 'error' && (
          <section aria-live="polite" className="mx-auto my-12 max-w-lg rounded-3xl border border-[#e1d7c5] bg-[#fffdf8] p-8 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#9a7838]">Musafir menu</p>
            <h2 className="mt-3 font-serif text-3xl">We’ll be right back.</h2>
            <p className="mt-3 text-sm leading-6 text-[#777064]">{state.message}</p>
            {query.branchId && <button type="button" onClick={() => void load()} className="mt-6 rounded-full bg-[#211f1a] px-6 py-3 text-xs font-bold uppercase tracking-[.16em] text-[#f2d99e] transition hover:bg-[#39352d]">Try again</button>}
          </section>
        )}

        {menu && (
          <>
            <div className="sticky top-0 z-20 -mx-5 border-b border-[#e4dccd] bg-[#f4f0e7]/95 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter menu by category">
                  <button type="button" onClick={() => setActiveCategory(null)} aria-pressed={activeCategory === null} className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[.14em] transition ${activeCategory === null ? 'bg-[#211f1a] text-[#f2d99e]' : 'border border-[#d9cfbd] text-[#6e675b] hover:border-[#9a7838]'}`}>Everything</button>
                  {menu.categories.map(category => (
                    <button key={category} type="button" onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category} className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[.14em] transition ${activeCategory === category ? 'bg-[#211f1a] text-[#f2d99e]' : 'border border-[#d9cfbd] text-[#6e675b] hover:border-[#9a7838]'}`}>{category}</button>
                  ))}
                </div>
                <label className="flex min-w-0 items-center gap-2 rounded-full border border-[#ded5c5] bg-[#fffdf8] px-4 py-2 sm:w-64">
                  <span aria-hidden="true" className="text-[#9a7838]">⌕</span>
                  <span className="sr-only">Search menu</span>
                  <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find your favourite…" className="w-full bg-transparent text-xs text-[#211f1a] outline-none placeholder:text-[#9a9386]" />
                  {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-xs text-[#777064]">×</button>}
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between py-7">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[.28em] text-[#9a7838]">The selection</p>
                <h2 className="mt-1 font-serif text-3xl tracking-tight">{activeCategory || 'Explore our menu'}</h2>
              </div>
              <p className="text-[10px] uppercase tracking-[.16em] text-[#8a8275]">{visibleCount} {visibleCount === 1 ? 'item' : 'items'}</p>
            </div>

            {menu.itemCount === 0 ? (
              <p className="rounded-3xl border border-[#e4dccd] bg-[#fffdf8] p-10 text-center font-serif text-xl text-[#777064]">Today’s menu is being prepared. Please ask our team.</p>
            ) : visibleSections.length === 0 ? (
              <p className="rounded-3xl border border-[#e4dccd] bg-[#fffdf8] p-10 text-center text-sm text-[#777064]">No matches. Try another search or category.</p>
            ) : (
              <div className="space-y-10">
                {visibleSections.map(section => (
                  <section key={section.title} aria-labelledby={`section-${section.title.replace(/\\s+/g, '-').toLowerCase()}`}>
                    {(!activeCategory || search.trim()) && <div className="mb-4 flex items-center gap-3"><h3 id={`section-${section.title.replace(/\\s+/g, '-').toLowerCase()}`} className="font-serif text-xl">{section.title}</h3><span className="h-px flex-1 bg-[#dfd6c7]" /><span className="text-[10px] text-[#928979]">{section.items.length}</span></div>}
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{section.items.map(item => <ProductCard key={item.id} item={item} />)}</div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="bg-[#171916] text-[#e8e0d1]">
        <div className="mx-auto grid max-w-6xl gap-7 px-5 py-9 sm:grid-cols-[1fr_auto] sm:items-end sm:px-8">
          <div>
            <p className="font-serif text-2xl italic text-[#e2c27e]">Good food. Good company.</p>
            <p className="mt-2 max-w-md text-xs leading-5 text-[#aaa393]">Browse the menu here, then place your order with our counter team.</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[9px] uppercase tracking-[.24em] text-[#b49a61]">Payment at counter</p>
            <p className="mt-2 text-xs text-[#e8e0d1]">Cash <span className="mx-2 text-[#b49a61]">·</span> Mada</p>
            <p className="mt-2 text-[10px] text-[#aaa393]">Prices in SAR · VAT shown at checkout</p>
          </div>
        </div>
      </footer>
      <div className="border-t border-white/10 bg-[#171916] pb-[env(safe-area-inset-bottom)] text-center text-[9px] uppercase tracking-[.2em] text-[#777568]">Musafir · Made to be remembered</div>
      {menu && <button type="button" onClick={() => void load()} disabled={refreshing} className="fixed bottom-5 right-5 z-30 rounded-full border border-[#d8b66b]/60 bg-[#211f1a] px-4 py-3 text-[10px] font-bold uppercase tracking-[.14em] text-[#f2d99e] shadow-xl transition hover:bg-[#39352d] disabled:opacity-60">{refreshing ? 'Updating…' : 'Refresh menu'}</button>}
    </div>
  );
}
