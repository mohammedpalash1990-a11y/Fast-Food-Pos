import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Link2, Printer, QrCode, RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { Badge, Button, Labeled, PageHeader, panel, Select } from '../components/ui';
import { qrUrl } from '../lib/api';

export default function QrMenuPage() {
  const { data, money, notify } = useStore();
  const [tableId, setTableId] = useState(data.tables[0]?.id ?? '');
  const defaultMenuUrl = () => {
    const stored = data.settings.publicMenuUrl;
    if (!stored || stored.includes('musafir-pos.local')) return `${window.location.origin}/menu`;
    return stored;
  };
  const [baseUrl, setBaseUrl] = useState(defaultMenuUrl);
  const [bust, setBust] = useState(0);

  const table = data.tables.find(entry => entry.id === tableId) ?? data.tables[0];
  const src = useMemo(
    () => qrUrl(table?.number ?? 'T-01', baseUrl || `${window.location.origin}/menu`, data.settings.branchCode) + `&v=${bust}`,
    [table?.number, baseUrl, data.settings.branchCode, bust]
  );
  const resolvedBase = baseUrl || `${window.location.origin}/menu`;

  useEffect(() => {
    if (!tableId && data.tables[0]) setTableId(data.tables[0].id);
  }, [tableId, data.tables]);

  const publicLink = `${(baseUrl || `${window.location.origin}/menu`).replace(/\/$/, '')}?branch=${encodeURIComponent(data.settings.branchCode)}&table=${encodeURIComponent(table?.number ?? '')}`;
  const liveProducts = data.products.filter(product => product.active !== false);
  const categories = Array.from(new Set(liveProducts.map(product => product.category)));

  const printSheet = () => {
    const win = window.open('', '_blank', 'width=720,height=900');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>QR table cards</title><style>
      body{font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;color:#15181c}
      h1{font-size:18px;margin:0 0 4px}p{color:#666;font-size:12px;margin:0 0 18px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .card{border:1px solid #e3e0d7;border-radius:14px;padding:14px;text-align:center}
      .table{font-size:22px;font-weight:800}.brand{font-size:10px;letter-spacing:2px;color:#a37c14;text-transform:uppercase}
      img{width:180px;height:180px;margin:8px auto}.hint{font-size:10px;color:#777}
      @media print{.card{break-inside:avoid}}</style></head><body>
      <h1>${data.settings.restaurantName} — QR menu cards</h1>
      <p>${data.settings.branchName} · scan to open the digital menu</p>
      <div class="grid">${data.tables
        .map(
          entry => `<div class="card"><div class="brand">${data.settings.restaurantName}</div><div class="table">${entry.number}</div>
          <img src="${qrUrl(entry.number, resolvedBase, data.settings.branchCode)}" alt="${entry.number} QR" />
          <div class="hint">Scan to view the menu & order</div></div>`
        )
        .join('')}</div></body></html>`);
    win.document.close();
    win.setTimeout(() => win.print(), 900);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Digital channel"
        title="QR menu"
        subtitle="Every table gets a scannable code that opens the live menu for this branch."
        actions={
          <>
            <Button variant="outline" onClick={() => setBust(value => value + 1)}><RefreshCw size={13} /> Refresh code</Button>
            <Button onClick={printSheet}><Printer size={13} /> Print table cards</Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[330px_1fr]">
        <div className={`${panel} p-4`}>
          <div className="flex items-center justify-between">
            <h3 className="text-[12.5px] font-semibold text-slate-200">Table QR code</h3>
            <Badge tone="gold"><QrCode size={9} /> live</Badge>
          </div>
          <div className="mt-3 rounded-2xl border border-white/[.08] bg-white p-3">
            <img src={src} alt={`QR code for ${table?.number ?? 'table'}`} className="mx-auto h-[220px] w-[220px] object-contain" />
            <div className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[.18em] text-[#a37c14]">{data.settings.restaurantName}</div>
            <div className="text-center font-serif text-[20px] text-[#15181c]">{table?.number ?? 'T-01'}</div>
          </div>

          <div className="mt-3 space-y-2.5">
            <Labeled label="Table">
              <Select value={tableId} onChange={setTableId} options={data.tables.map(entry => ({ value: entry.id, label: `${entry.number} · ${entry.zone}` }))} />
            </Labeled>
            <Labeled label="Public menu base URL" hint="Used inside the QR payload — point it at your hosted menu.">
              <input value={baseUrl} onChange={event => setBaseUrl(event.target.value)} className="w-full rounded-xl border border-white/[.09] bg-[#101418] px-3 py-2 text-[12px] text-slate-100 outline-none focus:border-[#e7b943]/50" />
            </Labeled>
            <div className="flex gap-1.5">
              <a href={src} download={`qr-${table?.number ?? 'table'}.png`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#f1cb6b] to-[#d9a63a] px-3 py-2 text-[12px] font-semibold text-[#241a06]">
                <Download size={13} /> Download PNG
              </a>
              <a href={publicLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/12 px-3 py-2 text-[12px] text-slate-200 hover:bg-white/[.04]">
                <ExternalLink size={13} /> Open
              </a>
            </div>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(publicLink).then(() => notify('Menu link copied to clipboard.')).catch(() => notify(publicLink));
              }}
              className="flex w-full items-center gap-1.5 rounded-lg border border-white/[.07] bg-white/[.02] px-2.5 py-2 text-left text-[10px] text-slate-500 hover:text-slate-300"
            >
              <Link2 size={11} className="shrink-0" /> <span className="truncate">{publicLink}</span>
            </button>
          </div>
        </div>

        <div className={`${panel} p-4`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-[12.5px] font-semibold text-slate-200">Public menu preview</h3>
              <p className="mt-0.5 text-[10.5px] text-slate-500">{liveProducts.length} live items across {categories.length} categories — this is exactly what guests see after scanning.</p>
            </div>
            <Badge tone="green">Synced with menu management</Badge>
          </div>

          <div className="mt-3 rounded-2xl border border-white/[.08] bg-[#f6f2e8] p-4 text-[#1b1d1f]">
            <div className="flex items-center justify-between border-b border-[#e2dccc] pb-3">
              <div>
                <div className="font-serif text-[19px] leading-tight">{data.settings.restaurantName}</div>
                <div className="text-[10px] uppercase tracking-[.18em] text-[#a37c14]">{data.settings.branchName} · Table {table?.number ?? 'T-01'}</div>
              </div>
              <div className="text-right text-[10px] text-[#6b6656]">
                {data.settings.phone}
                <br />
                VAT {data.settings.taxRate}%
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {categories.map(category => (
                <div key={category}>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#a37c14]">{category}</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {liveProducts.filter(product => product.category === category).map(product => (
                      <div key={product.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5">
                        <span className="truncate text-[11.5px]">{product.name}</span>
                        <span className="shrink-0 text-[11.5px] font-semibold">{money(product.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-[#e2dccc] pt-2 text-center text-[9.5px] text-[#8a8474]">{data.settings.receiptFooter}</div>
          </div>
        </div>
      </div>

      <div className={`${panel} mt-3 p-4`}>
        <h3 className="text-[12.5px] font-semibold text-slate-200">All table codes</h3>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.tables.map(entry => (
            <button
              key={entry.id}
              onClick={() => setTableId(entry.id)}
              className={`rounded-xl border p-2 transition ${entry.id === tableId ? 'border-[#e7b943]/40 bg-[#e7b943]/[.06]' : 'border-white/[.07] bg-white/[.02] hover:border-white/20'}`}
            >
              <div className="rounded-lg bg-white p-1.5">
                <img src={qrUrl(entry.number, resolvedBase, data.settings.branchCode)} alt={`${entry.number} QR`} className="mx-auto h-24 w-24 object-contain" />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[11.5px] font-medium text-slate-200">{entry.number}</span>
                <Badge tone={entry.status === 'Occupied' ? 'red' : 'slate'}>{entry.status}</Badge>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
