import { useState } from 'react';
import { ChefHat, Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useStore } from '../store';
import { Button, inputCls, Labeled } from '../components/ui';

const demoAccounts = [
  { email: 'admin@musafir.local', role: 'Owner' },
  { email: 'manager@musafir.local', role: 'Manager' },
  { email: 'cashier@musafir.local', role: 'Cashier' },
  { email: 'kitchen@musafir.local', role: 'Kitchen' }
];

export default function LoginPage() {
  const { login, authBusy, enterOffline, message } = useStore();
  const [email, setEmail] = useState('admin@musafir.local');
  const [password, setPassword] = useState('Musafir@2026!');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#0b0e11] px-4 py-8">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#e7b943]/10 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-[#b37a18]/10 blur-[110px]" />
      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/[.08] bg-[#0f1317] shadow-[0_40px_120px_-40px_rgba(0,0,0,.9)] md:grid-cols-[1.05fr_1fr]">
        <div className="hidden flex-col justify-between gap-8 border-r border-white/[.06] bg-gradient-to-br from-[#191d1c] via-[#12161a] to-[#0f1216] p-8 md:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#f0ca69] to-[#b37a18] text-[#201707]">
                <ChefHat size={22} />
              </div>
              <div>
                <div className="font-serif text-xl font-bold tracking-wide text-white">Musafir</div>
                <div className="text-[9px] uppercase tracking-[.3em] text-[#cba84c]">Fast Food</div>
              </div>
            </div>
            <h1 className="mt-9 font-serif text-[30px] leading-tight text-white">Restaurant operations,<br />connected end to end.</h1>
            <p className="mt-3 max-w-sm text-[12.5px] leading-6 text-slate-400">
              SQLite-backed POS with billing, kitchen display, inventory recipes, staff payroll, dues and profit reporting — all in one branch console.
            </p>
          </div>
          <div className="space-y-3">
            {[
              'Live order lifecycle from counter to kitchen',
              'Recipe-linked stock and automatic low-stock alerts',
              'Daily cash, dues, supplier and payroll ledger'
            ].map(line => (
              <div key={line} className="flex items-start gap-2.5 text-[11.5px] text-slate-400">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#e7b943]" />
                {line}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-[#e7b943]/15 bg-[#e7b943]/[.06] px-3.5 py-3">
            <div className="text-[9.5px] font-semibold uppercase tracking-[.18em] text-[#cba84c]">Seeded demo login</div>
            <div className="mt-1 font-mono text-[11.5px] text-slate-300">admin@musafir.local</div>
            <div className="font-mono text-[11.5px] text-slate-300">Musafir@2026!</div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6 md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#f0ca69] to-[#b37a18] text-[#201707]">
                <ChefHat size={18} />
              </div>
              <div>
                <div className="font-serif text-lg font-bold text-white">Musafir Fast Food</div>
                <div className="text-[9px] uppercase tracking-[.26em] text-[#cba84c]">POS Console</div>
              </div>
            </div>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#cba84c]">Branch sign in</div>
          <h2 className="mt-1.5 font-serif text-2xl text-white">Welcome back</h2>
          <p className="mt-1 text-[12px] text-slate-500">Use your staff account to open the console.</p>

          <form
            className="mt-6 space-y-3.5"
            onSubmit={event => {
              event.preventDefault();
              void submit();
            }}
          >
            <Labeled label="Work email">
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className={inputCls}
                placeholder="you@musafir.local"
              />
            </Labeled>
            <Labeled label="Password">
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className={`${inputCls} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow(value => !value)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:text-slate-300"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Labeled>

            {error ? (
              <div role="alert" className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-200">
                {error}
              </div>
            ) : null}
            {message ? <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11.5px] text-amber-100">{message}</div> : null}

            <Button type="submit" disabled={authBusy} className="w-full py-2.5">
              {authBusy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={14} />}
              {authBusy ? 'Signing in…' : 'Sign in to console'}
            </Button>
          </form>

          <div className="mt-5">
            <div className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-600">Quick demo accounts · password Musafir@2026!</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {demoAccounts.map(account => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword('Musafir@2026!');
                    setError(null);
                  }}
                  className="rounded-lg border border-white/[.07] bg-white/[.02] px-2.5 py-1.5 text-left transition hover:border-[#e7b943]/30 hover:bg-[#e7b943]/[.06]"
                >
                  <div className="text-[11px] font-medium text-slate-200">{account.role}</div>
                  <div className="truncate font-mono text-[9.5px] text-slate-600">{account.email}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={enterOffline}
            className="mt-4 w-full text-center text-[10.5px] text-slate-600 underline decoration-dotted underline-offset-4 hover:text-slate-400"
          >
            Continue in offline preview mode
          </button>
        </div>
      </div>
    </div>
  );
}
