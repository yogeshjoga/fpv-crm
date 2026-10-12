import { useState } from 'react';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { Button, Checkbox, Modal } from '../../components/ui/kit';

export interface ResendRecipient {
  id: string;
  name: string;
  email: string;
  certId: string;
}
export interface ResendResult {
  id: string;
  ok: boolean;
  message?: string;
}

/**
 * Confirm, send and report for "email the certificate again". Shows exactly who gets the email and which certificate, says
 * that the same PDF is sent (nothing is regenerated or changed), and then shows, per person, whether it went out.
 */
export function ResendCertificateModal({
  courseTitle,
  recipients,
  send,
  onClose,
}: {
  courseTitle: string;
  recipients: ResendRecipient[];
  send: (ids: string[]) => Promise<ResendResult[]>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(recipients.map((r) => r.id)));
  const [phase, setPhase] = useState<'confirm' | 'sending' | 'done'>('confirm');
  const [results, setResults] = useState<ResendResult[]>([]);
  const many = recipients.length > 1;

  const run = async () => {
    setPhase('sending');
    try {
      setResults(await send([...picked]));
    } catch (e) {
      setResults([...picked].map((id) => ({ id, ok: false, message: e instanceof Error ? e.message : 'Could not send' })));
    }
    setPhase('done');
  };

  const by = new Map(results.map((r) => [r.id, r]));
  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;

  return (
    <Modal open onClose={phase === 'sending' ? () => undefined : onClose} title="Email the certificate again">
      <div className="space-y-4">
        {phase !== 'done' && (
          <p className="text-sm text-neutral-600">
            The certificate PDF for <span className="font-medium text-neutral-900">{courseTitle}</span> is sent again to {many ? 'the students below' : 'this student'}. It is the same file that was issued, so nothing is regenerated or changed.
          </p>
        )}

        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {recipients.map((r) => {
            const res = by.get(r.id);
            return (
              <li key={r.id} className="flex items-start gap-3 rounded-xl border border-white/70 bg-white/60 px-3 py-2.5">
                {phase === 'confirm' && many ? (
                  <Checkbox
                    label=""
                    checked={picked.has(r.id)}
                    onChange={(e) =>
                      setPicked((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(r.id);
                        else n.delete(r.id);
                        return n;
                      })
                    }
                  />
                ) : phase === 'done' ? (
                  res?.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                ) : (
                  <Mail size={18} className="mt-0.5 shrink-0 text-neutral-400" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-900">{r.name}</div>
                  <div className="truncate text-xs text-neutral-500">{r.email}</div>
                  <div className="font-mono text-[10px] text-neutral-400">{r.certId}</div>
                  {phase === 'done' && res && !res.ok && <div className="mt-1 text-xs text-red-600">{res.message ?? 'Could not be sent'}</div>}
                </div>
                {phase === 'done' && res?.ok && <span className="text-xs font-medium text-green-700">Sent</span>}
              </li>
            );
          })}
        </ul>

        {phase === 'done' && (
          <p className={`rounded-xl px-3 py-2 text-sm ${failed ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
            {sent ? `Emailed to ${sent} student${sent === 1 ? '' : 's'}.` : 'Nothing was sent.'} {failed ? `${failed} could not be sent, see above.` : ''}
          </p>
        )}

        <div className="flex justify-end gap-2">
          {phase === 'done' ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={phase === 'sending'}>
                Cancel
              </Button>
              <Button onClick={run} loading={phase === 'sending'} disabled={!picked.size}>
                <Mail size={15} /> Send to {picked.size} {picked.size === 1 ? 'student' : 'students'}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
