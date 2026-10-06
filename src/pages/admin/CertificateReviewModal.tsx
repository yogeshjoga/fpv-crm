import { useMemo, useState } from 'react';
import { Award, CheckCircle2, Search, XCircle } from 'lucide-react';
import { Badge, Button, Modal, TextInput } from '../../components/ui/kit';

export interface ReviewCandidate {
  id: string;
  name: string;
  email: string;
  /** 'ready' can be sent now; 'waiting' is still missing something and can't be selected. */
  state: 'ready' | 'waiting';
  waiting?: string[];
  /** What the certificate would say: Merit / Participation for 100-mark assessments, Passed for a single exam. */
  result?: string;
  /** Every module cleared (100-mark assessments) or the exam passed. */
  qualified?: boolean;
  failed?: string[];
  modules?: { key: string; label: string; marks: number; max: number; pass: number; cleared: boolean }[];
  total?: number;
  max?: number;
  /** Single-exam courses: the best score. */
  scorePct?: number;
}

/**
 * Human-in-the-loop certificate sending. The admin sees each student's results, ticks the ones who should get a
 * certificate (all at once, only the ones who qualified, or one by one), and nothing is emailed until they confirm.
 */
export function CertificateReviewModal({
  courseTitle,
  candidates,
  onSend,
  onClose,
}: {
  courseTitle: string;
  candidates: ReviewCandidate[];
  onSend: (ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'qualified' | 'not'>('all');
  const [busy, setBusy] = useState(false);

  const ready = candidates.filter((c) => c.state === 'ready');
  const qualified = ready.filter((c) => c.qualified);
  const notQualified = ready.filter((c) => !c.qualified);
  const waiting = candidates.filter((c) => c.state === 'waiting');

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (s && !c.name.toLowerCase().includes(s) && !c.email.toLowerCase().includes(s)) return false;
      if (filter === 'qualified') return c.state === 'ready' && c.qualified;
      if (filter === 'not') return c.state === 'ready' && !c.qualified;
      return true;
    });
  }, [candidates, search, filter]);

  const toggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const pick = (list: ReviewCandidate[]) => setPicked(new Set(list.map((c) => c.id)));

  const selected = ready.filter((c) => picked.has(c.id));
  const selectedNotQualified = selected.filter((c) => !c.qualified).length;

  const send = async () => {
    setBusy(true);
    try {
      await onSend(selected.map((c) => c.id));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const tabs: [typeof filter, string, number][] = [
    ['all', 'Everyone', candidates.length],
    ['qualified', 'Qualified', qualified.length],
    ['not', 'Did not qualify', notQualified.length],
  ];

  return (
    <Modal open onClose={onClose} title={`Review and send certificates — ${courseTitle}`} wide>
      <p className="text-sm text-neutral-600">
        Nothing is sent automatically. Look at each student&apos;s results, tick the ones who should receive a certificate, then confirm. Each tick sends the
        certificate PDF{candidates.some((c) => c.modules) ? ' and a module-by-module report card' : ''} to the student&apos;s email.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative w-56 max-w-full">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <TextInput placeholder="Find a student…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="inline-flex rounded-full border border-white/60 bg-white/50 p-1 text-xs">
          {tabs.map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${filter === key ? 'bg-[#1a1a1a] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
            >
              {label} ({n})
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
          <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => pick(ready)} disabled={!ready.length}>
            Select all ready ({ready.length})
          </button>
          <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => pick(qualified)} disabled={!qualified.length}>
            Select qualified only ({qualified.length})
          </button>
          <button type="button" className="font-medium text-neutral-500 hover:underline" onClick={() => setPicked(new Set())} disabled={!picked.size}>
            Clear
          </button>
        </div>
      </div>

      <div className="mt-3 max-h-[26rem] overflow-y-auto rounded-2xl border border-white/60 bg-white/40">
        {!shown.length ? (
          <p className="p-6 text-center text-sm text-neutral-500">No students to show.</p>
        ) : (
          <ul className="divide-y divide-white/60">
            {shown.map((c) => {
              const can = c.state === 'ready';
              return (
                <li key={c.id} className={`flex items-start gap-3 px-3 py-3 ${can ? '' : 'opacity-60'}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    disabled={!can}
                    checked={picked.has(c.id)}
                    onChange={(e) => toggle(c.id, e.target.checked)}
                    aria-label={`Send a certificate to ${c.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-900">{c.name}</span>
                      <span className="text-xs text-neutral-400">{c.email}</span>
                      {can ? (
                        <Badge tone={c.qualified ? 'green' : 'amber'}>{c.result ?? (c.qualified ? 'Qualified' : 'Did not qualify')}</Badge>
                      ) : (
                        <Badge tone="neutral">Waiting</Badge>
                      )}
                    </div>

                    {c.modules ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.modules.map((m) => (
                          <span
                            key={m.key}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              m.cleared ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                            }`}
                            title={`Pass mark ${m.pass}`}
                          >
                            {m.cleared ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                            {m.label} {m.marks}/{m.max}
                          </span>
                        ))}
                        {c.total !== undefined && (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                            Total {c.total}/{c.max}
                          </span>
                        )}
                      </div>
                    ) : c.scorePct !== undefined ? (
                      <div className="mt-1 text-xs text-neutral-500">Best score {c.scorePct}%</div>
                    ) : null}

                    {c.state === 'waiting' && c.waiting?.length ? <div className="mt-1 text-xs text-neutral-500">Still needs: {c.waiting.join(', ')}</div> : null}
                    {can && !c.qualified && c.failed?.length ? <div className="mt-1 text-[11px] font-medium text-red-600">Not cleared: {c.failed.join(', ')}</div> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {waiting.length > 0 && <p className="mt-2 text-xs text-neutral-500">{waiting.length} student{waiting.length === 1 ? ' is' : 's are'} still waiting on marks and can&apos;t be selected yet.</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900">{selected.length}</span> selected
          {selectedNotQualified > 0 && (
            <span className="ml-2 text-xs font-medium text-amber-700">
              including {selectedNotQualified} who did not qualify (they would get a Participation certificate)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={busy} disabled={!selected.length}>
            <Award size={15} /> Send {selected.length || ''} certificate{selected.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
