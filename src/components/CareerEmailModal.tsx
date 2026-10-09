import { useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import { invokeFn } from '../lib/functions';
import { buildEmail, EMAIL_TEMPLATE_LABEL, type EmailContext, type EmailTemplateKey } from '../lib/careerEmails';
import { Button, Field, Modal, Select, TextArea, TextInput, useToast } from './ui/kit';

/**
 * Write and send an email to a candidate. The text is prepared from the job description and the round's schedule,
 * then HR reads and edits it before sending. The address is taken from the application on the server.
 */
export function CareerEmailModal({
  applicationId,
  toName,
  toEmail,
  context,
  initial,
  onClose,
  onSent,
}: {
  applicationId: string;
  toName: string;
  toEmail: string;
  context: EmailContext;
  initial: EmailTemplateKey;
  onClose: () => void;
  onSent?: () => void;
}) {
  const toast = useToast();
  const [key, setKey] = useState<EmailTemplateKey>(initial);
  const first = useMemo(() => buildEmail(initial, context), [initial, context]);
  const [subject, setSubject] = useState(first.subject);
  const [message, setMessage] = useState(first.body);
  const [busy, setBusy] = useState(false);

  const pick = (k: EmailTemplateKey) => {
    const t = buildEmail(k, context);
    setKey(k);
    setSubject(t.subject);
    setMessage(t.body);
  };

  const send = async () => {
    setBusy(true);
    try {
      const res = await invokeFn<{ sent: boolean; skipped: string | null }>('careers-email', { application_id: applicationId, subject, message });
      if (!res.sent) return toast(`The email could not be sent (${res.skipped ?? 'mail is not set up'}).`, 'error');
      toast(`Email sent to ${toEmail}`);
      onSent?.();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send the email', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Email ${toName}`} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="To">
            <TextInput value={toEmail} disabled />
          </Field>
          <Field label="Template" hint="Filled in from the job description and the round. Edit anything below.">
            <Select value={key} onChange={(e) => pick(e.target.value as EmailTemplateKey)}>
              {(Object.keys(EMAIL_TEMPLATE_LABEL) as EmailTemplateKey[]).map((k) => (
                <option key={k} value={k}>
                  {EMAIL_TEMPLATE_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Subject">
          <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Message" hint="A blank line starts a new paragraph. Lines starting with “- ” become bullets.">
          <TextArea rows={16} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={6000} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={busy}>
            <Mail size={15} /> Send email
          </Button>
        </div>
      </div>
    </Modal>
  );
}
