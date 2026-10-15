import { useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { useQuery } from '../../../lib/useQuery';
import { run, shopDb } from '../../../lib/shop';
import { Button, Field, PageHeader, Spinner, TextInput, useToast } from '../../../components/ui/kit';
import { Panel, fmtDateTime } from './ShopUi';

const TONES = [
  { key: 'info', label: 'Info', cls: 'bg-[#123a5e] text-white' },
  { key: 'deal', label: 'Deal', cls: 'bg-[#c8a127] text-[#0e2a49]' },
  { key: 'alert', label: 'Alert', cls: 'bg-[#b42318] text-white' },
] as const;
type Tone = (typeof TONES)[number]['key'];

interface Announcement { id: string; message: string; link: string | null; tone: string; is_active: boolean; ends_at: string | null }
interface Alert { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string }

/** Shop alerts link to the old store dashboard paths (/shop/...); they live under /admin/shop here. */
const alertLink = (link: string | null) => (link?.startsWith('/shop') ? `/admin${link}` : link || '/admin/shop');

export function ShopNotifications() {
  const { profile } = useAuth();
  const toast = useToast();
  const q = useQuery(async () => {
    const [items, alerts] = await Promise.all([
      run(shopDb.from('shop_announcements').select('id, message, link, tone, is_active, ends_at').order('created_at', { ascending: false }).limit(50)),
      run(
        shopDb
          .from('notifications')
          .select('id, title, body, link, read_at, created_at')
          .eq('recipient_id', profile?.id ?? '')
          .in('kind', ['shop_order', 'shop_stock'])
          .order('created_at', { ascending: false })
          .limit(30),
      ),
    ]);
    return { items: items as Announcement[], alerts: alerts as Alert[] };
  }, [profile?.id]);
  const unread = (q.data?.alerts ?? []).filter((a) => !a.read_at).length;

  const markRead = async () => {
    try {
      await run(
        shopDb.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', profile?.id ?? '').in('kind', ['shop_order', 'shop_stock']).is('read_at', null),
      );
      q.refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Store notifications" subtitle="Send a message to every store visitor, and see the alerts the shop sends you." />
      {q.loading && !q.data ? (
        <Spinner />
      ) : q.error ? (
        <p className="text-sm text-red-600">Couldn’t load notifications: {q.error}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <Panel title="Send a store announcement">
              <p className="-mt-1 mb-4 text-sm text-neutral-500">Shows as a bar at the top of every store page until it ends or you switch it off. Use it for sales, restocks, holidays and shipping delays.</p>
              <AnnouncementForm onSent={q.refetch} />
            </Panel>
            <Panel title="Announcements">
              {q.data?.items.length ? (
                <ul className="divide-y divide-black/5">
                  {q.data.items.map((a) => <AnnouncementRow key={a.id} a={a} onChange={q.refetch} />)}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">No announcements yet.</p>
              )}
            </Panel>
          </div>

          <Panel
            title={`Shop alerts${unread ? ` (${unread} new)` : ''}`}
            action={unread ? <button type="button" onClick={markRead} className="text-sm text-blue-600 hover:underline">Mark all read</button> : null}
          >
            <p className="-mt-1 mb-3 text-sm text-neutral-500">New orders and low stock. These also appear in your notification bell.</p>
            {q.data?.alerts.length ? (
              <ul className="space-y-1">
                {q.data.alerts.map((n) => (
                  <li key={n.id}>
                    <Link to={alertLink(n.link)} className={`block rounded-xl p-2.5 text-sm hover:bg-white/70 ${n.read_at ? '' : 'bg-amber-50'}`}>
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-neutral-900">{n.title}</span>
                        <span className="shrink-0 text-xs text-neutral-500">{fmtDateTime(n.created_at)}</span>
                      </span>
                      <span className="text-neutral-500">{n.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">No alerts yet. You’ll get one for every new order and when a product drops to its low-stock level.</p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function AnnouncementForm({ onSent }: { onSent: () => void }) {
  const toast = useToast();
  const [tone, setTone] = useState<Tone>('deal');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (text.length < 3) return toast('Keep the message between 3 and 200 characters.', 'error');
    const l = link.trim();
    if (l && !/^(\/|https:\/\/)/.test(l)) return toast('Links must start with / or https://', 'error');
    setSaving(true);
    try {
      await run(shopDb.from('shop_announcements').insert({ message: text, link: l || null, tone, ends_at: endsAt ? new Date(endsAt).toISOString() : null }));
      toast('Published. It’s live on the store within a minute.');
      setMessage('');
      setLink('');
      setEndsAt('');
      onSent();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <Field label={`Message (${message.length}/200)`}>
        <TextInput value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} required placeholder="e.g. DJI O4 Pro back in stock. Ships today." />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Link" hint="Optional"><TextInput value={link} onChange={(e) => setLink(e.target.value)} placeholder="/deals or https://…" /></Field>
        <Field label="Ends" hint="Optional"><TextInput type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
      </div>
      <fieldset className="flex items-center gap-1.5 text-sm">
        <legend className="sr-only">Style</legend>
        {TONES.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tone === t.key}
            onClick={() => setTone(t.key)}
            className={`rounded-full px-3 py-1 transition-colors ${tone === t.key ? 'bg-[#1a1a1a] text-white' : 'bg-white/60 text-neutral-700 hover:bg-white'}`}
          >
            {t.label}
          </button>
        ))}
      </fieldset>
      <div className={`rounded-xl px-3 py-2 text-center text-sm font-medium ${TONES.find((t) => t.key === tone)!.cls}`} aria-label="Preview">
        {message || 'Preview of the store bar'}
      </div>
      <Button type="submit" loading={saving}>Publish to store</Button>
    </form>
  );
}

function AnnouncementRow({ a, onChange }: { a: Announcement; onChange: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const expired = a.ends_at ? new Date(a.ends_at) < new Date() : false;
  const live = a.is_active && !expired;
  const act = async (p: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    setBusy(true);
    try {
      await run(p);
      onChange();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`flex flex-wrap items-center gap-3 py-3 text-sm ${busy ? 'opacity-60' : ''}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${live ? 'bg-green-600' : 'bg-neutral-300'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-neutral-900">{a.message}</span>
        <span className="text-xs text-neutral-500">
          {live ? 'Live' : expired ? 'Ended' : 'Off'}
          {a.ends_at ? `, ends ${fmtDateTime(a.ends_at)}` : ''}
          {a.link ? `, links to ${a.link}` : ''}
        </span>
      </span>
      {!expired && (
        <button type="button" disabled={busy} onClick={() => act(shopDb.from('shop_announcements').update({ is_active: !a.is_active }).eq('id', a.id))} className="text-blue-600 hover:underline">
          {a.is_active ? 'Switch off' : 'Switch on'}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => confirm('Delete this announcement?') && act(shopDb.from('shop_announcements').delete().eq('id', a.id))}
        className="text-red-600 hover:underline"
      >
        Delete
      </button>
    </li>
  );
}
