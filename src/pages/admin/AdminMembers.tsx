import { useMemo, useState } from 'react';
import { CheckCircle2, Download, FolderPlus, GraduationCap, UsersRound, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useAdminAccess } from '../../layout/AdminAccessContext';
import { useQuery, unwrap } from '../../lib/useQuery';
import { downloadCsv } from '../../lib/csv';
import { rpc, table, type MemberRow, type MembersOverview } from '../../lib/memberRpc';
import { GlassCard } from '../../components/ui/shared';
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, Spinner, TextInput, useToast } from '../../components/ui/kit';

const TYPES = [
  { key: 'individual', label: 'Individual', tone: 'neutral' as const },
  { key: 'paid', label: 'Paid', tone: 'green' as const },
  { key: 'workshop', label: 'Workshop', tone: 'blue' as const },
];
const typeTone = (t: string) => TYPES.find((x) => x.key === t)?.tone ?? 'neutral';
const typeLabel = (t: string) => TYPES.find((x) => x.key === t)?.label ?? t;

interface Workshop { id: string; name: string; code: string | null; starts_on: string | null }
interface Claim { id: string; profile_id: string; group_id: string | null; workshop_name: string; workshop_date: string | null; created_at: string; full_name: string; college_name: string }
interface Group { id: string; name: string; description: string; created_at: string; n: number }

export function AdminMembers() {
  const toast = useToast();
  const { canWrite } = useAdminAccess();
  const writable = canWrite('members');
  const { profile } = useAuth();
  const canExport = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [search, setSearch] = useState('');
  const [college, setCollege] = useState('');
  const [type, setType] = useState('');
  const [kind, setKind] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);

  const overview = useQuery(async () => {
    const { data, error } = await rpc<MembersOverview>('members_overview');
    if (error) throw new Error(error.message);
    return data as MembersOverview;
  }, []);
  const workshops = useQuery(
    () => unwrap(supabase.from('course_groups').select('id, name, code, starts_on').eq('kind', 'workshop').order('starts_on', { ascending: false, nullsFirst: false })) as Promise<Workshop[]>,
    [],
  );
  const members = useQuery(async () => {
    const { data, error } = await rpc<MemberRow[]>('members_directory', {
      p_search: search || null, p_college: college || null, p_type: type || null, p_workshop: workshop || null,
      p_from: from || null, p_to: to || null, p_kind: kind || null, p_limit: 2000,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as MemberRow[];
  }, [search, college, type, kind, workshop, from, to]);
  const claims = useQuery(async () => {
    const { data, error } = await table('member_workshops')
      .select('id, profile_id, group_id, workshop_name, workshop_date, created_at, profiles:profile_id(full_name, college_name)')
      .eq('status', 'claimed')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as (Omit<Claim, 'full_name' | 'college_name'> & { profiles: { full_name: string; college_name: string } | null })[]).map((c) => ({
      ...c, full_name: c.profiles?.full_name ?? '', college_name: c.profiles?.college_name ?? '',
    })) as Claim[];
  }, []);
  const groups = useQuery(async () => {
    const { data, error } = await table('member_groups').select('id, name, description, created_at, member_group_members(count)').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as (Omit<Group, 'n'> & { member_group_members: { count: number }[] })[]).map((g) => ({ ...g, n: g.member_group_members?.[0]?.count ?? 0 })) as Group[];
  }, []);

  const rows = members.data ?? [];
  const types = overview.data?.by_type ?? {};

  const exportCsv = (list: MemberRow[], name: string) => {
    const headers = ['Name', 'Email', 'Phone', 'College', 'Type', 'Account', 'Workshop', 'Workshop date', 'Joined', 'Last seen'];
    downloadCsv(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, headers, list.map((m) => [
      m.full_name, m.email, m.phone, m.college_name, typeLabel(m.member_type), m.account_kind === 'member' ? 'Website member' : 'Student',
      m.workshops, m.workshop_dates, new Date(m.created_at).toLocaleDateString('en-GB'), m.last_seen_at ? new Date(m.last_seen_at).toLocaleDateString('en-GB') : '',
    ]));
    toast(`Exported ${list.length} ${list.length === 1 ? 'person' : 'people'}`);
  };

  const makeGroup = async () => {
    if (!groupName.trim() || !rows.length) return;
    setBusy(true);
    try {
      const filter = { search, college, type, kind, workshop, from, to };
      const { data, error } = await table('member_groups').insert({ name: groupName.trim(), filter, created_by: profile?.id }).select('id').single();
      if (error || !data) throw new Error(error?.message ?? 'Could not create the group');
      const { error: addError } = await rpc<number>('member_group_add', { p_group: (data as unknown as { id: string }).id, p_ids: rows.map((r) => r.id) });
      if (addError) throw new Error(addError.message);
      toast(`Group "${groupName.trim()}" made with ${rows.length} people`);
      setGroupOpen(false);
      setGroupName('');
      groups.refetch();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (c: Claim, confirm: boolean) => {
    setBusy(true);
    try {
      if (confirm && c.group_id) {
        const { error } = await table('course_group_members').upsert({ group_id: c.group_id, student_id: c.profile_id, added_by: profile?.id }, { onConflict: 'group_id,student_id' });
        if (error) throw new Error(error.message);
      }
      const { error } = await table('member_workshops').update({ status: confirm ? 'confirmed' : 'rejected', decided_by: profile?.id, decided_at: new Date().toISOString() }).eq('id', c.id);
      if (error) throw new Error(error.message);
      toast(confirm ? 'Workshop confirmed' : 'Workshop claim declined');
      claims.refetch();
      members.refetch();
      overview.refetch();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const groupFile = async (g: Group) => {
    const { data, error } = await table('member_group_members').select('profile_id').eq('group_id', g.id);
    if (error) return toast(error.message);
    const ids = new Set(((data ?? []) as unknown as { profile_id: string }[]).map((x) => x.profile_id));
    const { data: all } = await rpc<MemberRow[]>('members_directory', { p_limit: 3000 });
    exportCsv(((all ?? []) as MemberRow[]).filter((m) => ids.has(m.id)), `group-${g.name.replace(/\W+/g, '-')}`);
  };

  const colleges = useMemo(() => overview.data?.colleges ?? [], [overview.data]);
  if (!overview.data) return overview.error ? <EmptyState icon={<UsersRound size={22} />} title="Could not load members" description={overview.error} /> : <Spinner />;

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Everyone who signed in or registered, with their college, type and workshop. Filter, make groups, export."
        actions={
          <div className="flex gap-2">
            {writable && (
              <Button variant="secondary" onClick={() => setGroupOpen(true)} disabled={!rows.length}>
                <FolderPlus size={15} /> Make a group from this list
              </Button>
            )}
            {canExport && (
              <Button variant="secondary" onClick={() => exportCsv(rows, 'members')} disabled={!rows.length}>
                <Download size={15} /> Export CSV
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <GlassCard className="p-4"><div className="text-sm text-neutral-500">Everyone</div><div className="text-2xl font-semibold">{overview.data.total}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-sm text-neutral-500">Website members</div><div className="text-2xl font-semibold">{overview.data.members}</div></GlassCard>
        {TYPES.map((t) => (
          <GlassCard key={t.key} className="p-4"><div className="text-sm text-neutral-500">{t.label}</div><div className="text-2xl font-semibold">{types[t.key] ?? 0}</div></GlassCard>
        ))}
      </div>

      {(claims.data?.length ?? 0) > 0 && (
        <GlassCard className="mb-5 p-5">
          <h3 className="mb-1 font-medium text-neutral-900">Workshop claims to check ({claims.data?.length})</h3>
          <p className="mb-3 text-xs text-neutral-500">Members who say they were in a workshop. Confirming a listed workshop adds them to that workshop's group, which also gives them its courses.</p>
          <ul className="divide-y divide-black/5">
            {claims.data?.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <b>{c.full_name || 'Unnamed'}</b> <span className="text-neutral-500">· {c.college_name || 'no college'} · {c.workshop_name}{c.workshop_date ? ` · ${c.workshop_date}` : ''}</span>
                  {!c.group_id && <Badge tone="amber">not a listed workshop</Badge>}
                </span>
                {writable && (
                  <span className="flex gap-2">
                    <Button variant="secondary" onClick={() => decide(c, true)} disabled={busy}><CheckCircle2 size={14} /> Confirm</Button>
                    <Button variant="secondary" onClick={() => decide(c, false)} disabled={busy}><XCircle size={14} /> Decline</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <div className="mb-3 grid gap-3 md:grid-cols-4">
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" />
        <Select value={college} onChange={(e) => setCollege(e.target.value)}>
          <option value="">All colleges</option>
          {colleges.map((c) => <option key={c.college} value={c.college}>{c.college} ({c.n})</option>)}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Students and members</option>
          <option value="member">Website members only</option>
          <option value="student">CRM students only</option>
        </Select>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Select value={workshop} onChange={(e) => setWorkshop(e.target.value)}>
          <option value="">Any workshop</option>
          {(workshops.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ''}</option>)}
        </Select>
        <Field label="Workshop from"><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Workshop to"><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <div className="flex items-end text-sm text-neutral-500">{members.data ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'}` : 'Loading…'}</div>
      </div>

      {!members.data ? <Spinner /> : !rows.length ? (
        <EmptyState icon={<UsersRound size={22} />} title="No one matches" description="Try removing a filter." />
      ) : (
        <GlassCard className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-neutral-500">
              <tr><th className="px-4 py-2">Name</th><th>College</th><th>Type</th><th>Workshop</th><th>Joined</th><th>Account</th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-black/5">
                  <td className="px-4 py-2"><div className="font-medium text-neutral-900">{m.full_name || '—'}</div><div className="text-xs text-neutral-500">{m.email}</div></td>
                  <td className="pr-3">{m.college_name || <span className="text-neutral-400">not given</span>}</td>
                  <td><Badge tone={typeTone(m.member_type)}>{typeLabel(m.member_type)}</Badge></td>
                  <td className="pr-3">{m.workshops ? <>{m.workshops}<div className="text-xs text-neutral-400">{m.workshop_dates}</div></> : '—'}</td>
                  <td className="whitespace-nowrap pr-3 text-neutral-500">{new Date(m.created_at).toLocaleDateString('en-GB')}</td>
                  <td><Badge tone={m.account_kind === 'member' ? 'blue' : 'neutral'}>{m.account_kind === 'member' ? 'Website' : 'Student'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {(groups.data?.length ?? 0) > 0 && (
        <GlassCard className="mt-5 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-medium text-neutral-900"><GraduationCap size={16} /> Saved groups</h3>
          <ul className="divide-y divide-black/5">
            {groups.data?.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span><b>{g.name}</b> <span className="text-neutral-500">· {g.n} {g.n === 1 ? 'person' : 'people'} · {new Date(g.created_at).toLocaleDateString('en-GB')}</span></span>
                {canExport && <Button variant="secondary" onClick={() => groupFile(g)}><Download size={14} /> CSV</Button>}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <Modal open={groupOpen} onClose={() => setGroupOpen(false)} title="Make a group from this list">
        <p className="mb-3 text-sm text-neutral-600">The {rows.length} {rows.length === 1 ? 'person' : 'people'} in the current list become a group you can find and export later. It does not give anyone course access.</p>
        <Field label="Group name"><TextInput value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Sivani, July 2026 workshop" maxLength={120} /></Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setGroupOpen(false)}>Cancel</Button>
          <Button onClick={makeGroup} loading={busy} disabled={!groupName.trim()}>Make group</Button>
        </div>
      </Modal>
    </div>
  );
}
