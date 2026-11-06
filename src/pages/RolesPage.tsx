import { useState } from 'react';
import { Check, KeyRound, Loader2, Lock, ShieldCheck, X } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../lib/api';
import { Badge, Button, DataTable, inputCls, Labeled, Modal, PageHeader, panel, Select, type Column } from '../components/ui';
import { allModules } from '../components/Shell';
import { rolePermissions } from '../lib/pos';
import { initials } from '../lib/format';
import type { AuthUser, Role } from '../types';

const roles: Role[] = ['owner', 'manager', 'cashier', 'kitchen', 'inventory', 'accountant', 'delivery'];

export default function RolesPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { data, user, notify, commit } = useStore();
  const [selectedRole, setSelectedRole] = useState<Role>('owner');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', displayName: '', role: 'cashier' as Role, password: '' });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const permission = rolePermissions.find(entry => entry.role === selectedRole) ?? rolePermissions[0];

  const accounts: (AuthUser & { local?: boolean })[] = data.users.length
    ? data.users
    : Array.from(new Map(rolePermissions.map(entry => [entry.role, entry])).values()).map((entry, index) => ({
        id: `seed-${index}`,
        email: `${entry.role}@musafir.local`,
        displayName: `${entry.label} account`,
        role: entry.role as Role,
        local: true
      }));

  const columns: Column<AuthUser>[] = [
    {
      key: 'user',
      header: 'Account',
      render: account => (
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#e7b943]/12 text-[10px] font-bold text-[#e7b943]">{initials(account.displayName)}</div>
          <div>
            <div className="font-medium text-slate-100">{account.displayName}</div>
            <div className="font-mono text-[10px] text-slate-500">{account.email}</div>
          </div>
        </div>
      )
    },
    { key: 'role', header: 'Role', render: account => <Badge tone={account.role === 'owner' ? 'gold' : 'slate'}>{account.role}</Badge> },
    {
      key: 'access',
      header: 'Module access',
      align: 'center',
      render: account => <span className="text-[11px] text-slate-400">{(rolePermissions.find(entry => entry.role === account.role)?.scopes.length ?? 0)} modules</span>
    },
    { key: 'status', header: 'Status', render: account => <Badge tone="green">{account.id === user?.id ? 'You · active' : 'Active'}</Badge> }
  ];

  const inviteUser = async () => {
    setInviteError(null);
    if (!invite.email.trim() || !invite.displayName.trim()) {
      setInviteError('Email and display name are required.');
      return;
    }
    if (invite.password.length < 8) {
      setInviteError('Set a temporary password of at least 8 characters so the staff member can sign in.');
      return;
    }
    setInviteBusy(true);
    try {
      const result = await api.createUser({
        email: invite.email.trim().toLowerCase(),
        displayName: invite.displayName.trim(),
        role: invite.role,
        password: invite.password
      });
      commit(
        { users: [...data.users.filter(entry => entry.id !== result.user.id), result.user] },
        { title: 'Staff account created', detail: `${result.user.displayName} · ${result.user.role} access`, actor: user?.displayName }
      );
      notify(`${result.user.displayName} can now sign in with the temporary password.`);
      setInviteOpen(false);
      setInvite({ email: '', displayName: '', role: 'cashier', password: '' });
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Could not create the staff account');
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Access control"
        title="User roles & permissions"
        subtitle="Role matrix shipped with the console. Roles are enforced on session tokens by the API."
        actions={<Button onClick={() => setInviteOpen(true)}><KeyRound size={13} /> Add staff account</Button>}
      />

      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <div className={`${panel} p-3`}>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Roles</div>
          <div className="space-y-1">
            {rolePermissions.map(entry => (
              <button
                key={entry.role}
                onClick={() => setSelectedRole(entry.role as Role)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                  selectedRole === entry.role ? 'border-[#e7b943]/35 bg-[#e7b943]/[.08]' : 'border-transparent hover:border-white/10 hover:bg-white/[.03]'
                }`}
              >
                <ShieldCheck size={13} className={selectedRole === entry.role ? 'text-[#e7b943]' : 'text-slate-500'} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-medium text-slate-200">{entry.label}</div>
                  <div className="text-[9.5px] text-slate-500">{entry.scopes.length} modules</div>
                </div>
                {selectedRole === entry.role ? <Check size={12} className="text-[#e7b943]" /> : null}
              </button>
            ))}
          </div>
        </div>

        <div className={`${panel} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold text-slate-100">{permission.label} permissions</h3>
              <p className="mt-0.5 text-[10.5px] text-slate-500">
                {permission.role === 'owner' ? 'Full access to every module and setting.' : `Scoped to ${permission.scopes.length} of ${allModules.length} modules.`}
              </p>
            </div>
            <Badge tone={permission.role === 'owner' ? 'gold' : 'slate'}>
              <Lock size={9} /> {permission.role === 'owner' ? 'unrestricted' : 'restricted'}
            </Badge>
          </div>

          <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {allModules.map(module => {
              const allowed = permission.scopes.includes(module.id);
              return (
                <div key={module.id} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${allowed ? 'border-emerald-400/15 bg-emerald-400/[.05]' : 'border-white/[.06] bg-white/[.015]'}`}>
                  <span className={`truncate text-[11px] ${allowed ? 'text-slate-200' : 'text-slate-500'}`}>{module.label}</span>
                  {allowed ? <Check size={11} className="shrink-0 text-emerald-400" /> : <X size={11} className="shrink-0 text-slate-600" />}
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2 text-[10.5px] text-slate-500">
            Accounts are created through <span className="font-mono text-slate-400">POST /api/users</span> with a bcrypt-hashed password. Sign-in tokens carry the staff role and are validated on every write.
          </div>
        </div>
      </div>

      <div className={`${panel} mt-3 p-3`}>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-[12.5px] font-semibold text-slate-200">Staff accounts</h3>
          <button onClick={() => onNavigate('settings')} className="text-[10px] text-slate-500 underline decoration-dotted hover:text-slate-300">branch settings</button>
        </div>
        <DataTable columns={columns} rows={accounts} rowKey={account => account.id} empty="No accounts yet." />
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Add staff account"
        subtitle="Creates a directory entry with the chosen role scope."
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => void inviteUser()} disabled={inviteBusy}>
              {inviteBusy ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
              {inviteBusy ? 'Creating…' : 'Add account'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Labeled label="Display name"><input value={invite.displayName} onChange={event => setInvite(current => ({ ...current, displayName: event.target.value }))} className={inputCls} placeholder="Sabbir Ahmed" /></Labeled>
          <Labeled label="Email"><input type="email" value={invite.email} onChange={event => setInvite(current => ({ ...current, email: event.target.value }))} className={inputCls} placeholder="cashier@musafir.local" /></Labeled>
          <Labeled label="Role"><Select value={invite.role} onChange={value => setInvite(current => ({ ...current, role: value as Role }))} options={roles.map(value => ({ value, label: value }))} /></Labeled>
          <Labeled label="Temporary password" hint="At least 8 characters — share it with the staff member, they can change it later.">
            <input type="text" value={invite.password} onChange={event => setInvite(current => ({ ...current, password: event.target.value }))} className={inputCls} placeholder="Temp-2026!" />
          </Labeled>
          {inviteError ? <div role="alert" className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{inviteError}</div> : null}
        </div>
      </Modal>
    </div>
  );
}
