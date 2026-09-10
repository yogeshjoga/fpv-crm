import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import type { Tables } from '../lib/database.types';

type Notification = Tables<'notifications'>;

export function NotificationBell() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    if (!session) return;
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [session, load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = items.filter((n) => !n.read_at).length;

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)));
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  };

  const openItem = async (n: Notification) => {
    if (!n.read_at) await markRead([n.id]);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/60 text-neutral-600 hover:bg-white"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-neutral-900">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markRead(items.filter((n) => !n.read_at).map((n) => n.id))}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!items.length ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">You’re all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`block w-full border-b border-neutral-50 px-4 py-3 text-left last:border-0 hover:bg-neutral-50 ${
                    n.read_at ? '' : 'bg-blue-50/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
                    <div className={n.read_at ? 'pl-3.5' : ''}>
                      <div className="text-sm font-medium text-neutral-900">{n.title}</div>
                      {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{n.body}</div>}
                      <div className="mt-1 text-[11px] text-neutral-400">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
