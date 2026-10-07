import { useEffect, useRef, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { Button, Field, Modal, Select, TextArea, TextInput, useToast } from '../../components/ui/kit';
import { MODE_LABEL, type WorkMode } from '../../lib/careers';
import {
  COMP_LABEL,
  EMPLOYMENT_LABEL,
  LEVEL_LABEL,
  addMonths,
  buildJd,
  defaultTerms,
  emptyOffer,
  employmentFor,
  type CompMode,
  type EmploymentType,
  type Level,
  type Offer,
  type RoleTemplate,
} from '../../lib/offers';
import { downloadOfferPdf, type SignMode } from '../../lib/offerPdf';
import { fetchOrgBrand, type OrgBrandInfo } from '../../lib/useOrgBrand';

type Draft = ReturnType<typeof emptyOffer>;

const num = (v: string) => (v.trim() === '' ? null : Number(v));
const monthsBetween = (a: string | null, b: string | null) => {
  if (!a || !b) return '';
  const d = new Date(`${b}T00:00:00`);
  const s = new Date(`${a}T00:00:00`);
  const m = (d.getFullYear() - s.getFullYear()) * 12 + (d.getMonth() - s.getMonth());
  return m > 0 && addMonths(a, m) === b ? String(m) : '';
};

/**
 * Prepare one offer letter. The admin gives the candidate's name, picks a role and a level, and the position,
 * job description and terms are filled in. Dates, pay and every line can then be changed before it is saved.
 */
export function OfferEditor({
  offer,
  initial,
  templates,
  onClose,
  onSaved,
}: {
  offer: Offer | null;
  initial?: Partial<Draft>;
  templates: RoleTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { profile } = useAuth();
  const [saved, setSaved] = useState<Offer | null>(offer);
  const [f, setF] = useState<Draft>(() => {
    const base: Draft = offer ? { ...emptyOffer(), ...offer } : { ...emptyOffer(), ...initial };
    if (!offer) base.terms = defaultTerms(base.employment_type as EmploymentType, base.probation_months, base.notice_days);
    return base;
  });
  const [brand, setBrand] = useState<OrgBrandInfo | null>(null);
  const [sign, setSign] = useState<SignMode>('signed');
  const [busy, setBusy] = useState<string | null>(null);
  // the text last written by the template; if the admin has changed it by hand we leave it alone
  const auto = useRef({ jd: '', terms: offer ? '' : defaultTerms(f.employment_type as EmploymentType, f.probation_months, f.notice_days) });

  useEffect(() => {
    void fetchOrgBrand().then((b) => {
      setBrand(b);
      setF((p) => (p.signatory_name ? p : { ...p, signatory_name: b.signatoryName }));
    });
  }, []);

  const change = (patch: Partial<Draft>) => {
    const next: Draft = { ...f, ...patch };
    const tpl = templates.find((t) => t.id === next.role_template_id);
    if ('role_template_id' in patch && tpl) {
      next.role_title = tpl.title;
      next.department = tpl.department;
    }
    if (('role_template_id' in patch || 'level' in patch) && !('employment_type' in patch)) next.employment_type = employmentFor(next.level as Level);
    if (tpl && f.jd === auto.current.jd && ('role_template_id' in patch || 'level' in patch)) {
      next.jd = buildJd(tpl, next.level as Level);
      auto.current.jd = next.jd;
    }
    if (f.terms === auto.current.terms && ('employment_type' in patch || 'role_template_id' in patch || 'level' in patch || 'probation_months' in patch || 'notice_days' in patch)) {
      next.terms = defaultTerms(next.employment_type as EmploymentType, next.probation_months, next.notice_days);
      auto.current.terms = next.terms;
    }
    // the date the company starts paying follows the end of training until it is set by hand
    if (('start_date' in patch || 'training_months' in patch) && next.compensation_mode === 'pay_to_train') {
      const prevAuto = f.start_date && f.training_months ? addMonths(f.start_date, f.training_months) : null;
      if (!f.post_training_from || f.post_training_from === prevAuto) next.post_training_from = next.start_date && next.training_months ? addMonths(next.start_date, next.training_months) : null;
    }
    setF(next);
  };

  const validate = (): string | null => {
    if (f.candidate_name.trim().length < 2) return "Enter the candidate's name";
    if (f.role_title.trim().length < 3) return 'Choose or type the role';
    if (f.end_date && f.start_date && f.end_date < f.start_date) return 'The end date is before the start date';
    if (f.compensation_mode === 'paid' && (f.pay_amount === null || Number.isNaN(f.pay_amount))) return 'Enter the pay amount, or choose Unpaid';
    if (f.compensation_mode === 'pay_to_train') {
      if (f.training_fee === null) return 'Enter the training fee the candidate pays';
      if (!f.training_months) return 'Enter how many months the training lasts';
      if (f.post_training_amount === null) return 'Enter what the company pays each month after training';
    }
    return null;
  };

  const save = async (issue = false): Promise<Offer | null> => {
    const err = validate();
    if (err) {
      toast(err, 'error');
      return null;
    }
    setBusy(issue ? 'issue' : 'save');
    const payload = { ...f, candidate_name: f.candidate_name.trim(), candidate_email: f.candidate_email.trim(), role_title: f.role_title.trim(), status: issue ? 'issued' : f.status };
    const res = saved
      ? await supabase.from('careers_offers').update(payload as never).eq('id', saved.id).select('*').single()
      : await supabase.from('careers_offers').insert({ ...payload, created_by: profile?.id } as never).select('*').single();
    if (res.error) {
      setBusy(null);
      toast(res.error.message, 'error');
      return null;
    }
    const row = res.data as unknown as Offer;
    if (issue && row.application_id) {
      // the applicant sees "Offer made" and is notified through the normal application flow
      await supabase.from('careers_applications').update({ status: 'offered' } as never).eq('id', row.application_id);
    }
    setBusy(null);
    setSaved(row);
    setF((p) => ({ ...p, status: row.status as Draft['status'] }));
    toast(issue ? 'Offer issued' : 'Saved');
    onSaved();
    return row;
  };

  const download = async (kind: 'offer' | 'jd') => {
    const err = validate();
    if (err) return toast(err, 'error');
    setBusy(kind);
    try {
      const org = brand ?? (await fetchOrgBrand());
      const now = new Date().toISOString();
      const asOffer = { id: saved?.id ?? '', offer_no: saved?.offer_no ?? 'DRAFT', created_at: saved?.created_at ?? now, updated_at: now, created_by: null, responded_at: null, ...f } as Offer;
      await downloadOfferPdf(kind, asOffer, org, sign);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not make the PDF', 'error');
    } finally {
      setBusy(null);
    }
  };

  const type = f.employment_type as EmploymentType;
  const mode = f.compensation_mode as CompMode;
  const set = <K extends keyof Draft>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => change({ [k]: e.target.value } as Partial<Draft>);
  const setNum = <K extends keyof Draft>(k: K) => (e: React.ChangeEvent<HTMLInputElement>) => change({ [k]: num(e.target.value) } as Partial<Draft>);
  const setDate = <K extends keyof Draft>(k: K) => (e: React.ChangeEvent<HTMLInputElement>) => change({ [k]: e.target.value || null } as Partial<Draft>);
  const section = 'mb-3 mt-6 text-sm font-semibold text-neutral-900 first:mt-0';

  return (
    <Modal open onClose={onClose} title={saved ? `Offer letter · ${saved.offer_no}` : 'New offer letter'} wide>
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <div className={section}>Candidate and role</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Candidate name" required>
            <TextInput value={f.candidate_name} onChange={set('candidate_name')} placeholder="Full name as it should appear on the letter" autoFocus />
          </Field>
          <Field label="Candidate email" hint="Optional. Printed on the letter">
            <TextInput type="email" value={f.candidate_email} onChange={set('candidate_email')} />
          </Field>
          <Field label="Role">
            <Select value={f.role_template_id ?? ''} onChange={(e) => change({ role_template_id: e.target.value || null })}>
              <option value="">Other role (type below)</option>
              {templates
                .filter((t) => t.is_active || t.id === f.role_template_id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Level">
            <Select value={f.level} onChange={(e) => change({ level: e.target.value as Level })}>
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Position title on the letter" required>
            <TextInput value={f.role_title} onChange={set('role_title')} />
          </Field>
          <Field label="Engagement">
            <Select value={f.employment_type} onChange={(e) => change({ employment_type: e.target.value as EmploymentType })}>
              {(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((k) => (
                <option key={k} value={k}>
                  {EMPLOYMENT_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department">
            <TextInput value={f.department} onChange={set('department')} />
          </Field>
          <Field label="Reporting to">
            <TextInput value={f.reporting_to} onChange={set('reporting_to')} placeholder="e.g. Head of Flight Operations" />
          </Field>
          <Field label="Work mode">
            <Select value={f.work_mode} onChange={set('work_mode')}>
              {(Object.keys(MODE_LABEL) as WorkMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location">
            <TextInput value={f.location} onChange={set('location')} placeholder="e.g. Visakhapatnam" />
          </Field>
          <Field label="Working hours">
            <TextInput value={f.working_hours} onChange={set('working_hours')} placeholder="e.g. Mon to Sat, 9:30 AM to 6:00 PM" />
          </Field>
        </div>

        <div className={section}>Dates</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Letter date">
            <TextInput type="date" value={f.issued_on} onChange={(e) => change({ issued_on: e.target.value })} />
          </Field>
          <Field label="Accept the offer by">
            <TextInput type="date" value={f.valid_until ?? ''} onChange={setDate('valid_until')} />
          </Field>
          <span />
          <Field label="Start date">
            <TextInput type="date" value={f.start_date ?? ''} onChange={setDate('start_date')} />
          </Field>
          <Field label="End date" hint={type === 'internship' || type === 'contract' ? undefined : 'Leave empty for a permanent role'}>
            <TextInput type="date" value={f.end_date ?? ''} onChange={setDate('end_date')} />
          </Field>
          <Field label="Duration in months" hint="Sets the end date from the start date">
            <TextInput
              type="number"
              min={1}
              value={monthsBetween(f.start_date, f.end_date)}
              onChange={(e) => {
                const m = Number(e.target.value);
                if (f.start_date && m > 0) change({ end_date: addMonths(f.start_date, m) });
              }}
              disabled={!f.start_date}
            />
          </Field>
          {type !== 'internship' && (
            <>
              <Field label="Probation (months)">
                <TextInput type="number" min={0} max={24} value={f.probation_months ?? ''} onChange={setNum('probation_months')} />
              </Field>
              <Field label="Notice period (days)">
                <TextInput type="number" min={0} max={365} value={f.notice_days ?? ''} onChange={setNum('notice_days')} />
              </Field>
            </>
          )}
        </div>

        <div className={section}>Pay</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="How is this role paid?">
              <Select value={f.compensation_mode} onChange={(e) => change({ compensation_mode: e.target.value as CompMode })}>
                {(Object.keys(COMP_LABEL) as CompMode[]).map((m) => (
                  <option key={m} value={m}>
                    {COMP_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {mode === 'paid' && (
            <>
              <Field label={type === 'internship' ? 'Stipend (₹)' : 'Salary (₹)'} required>
                <TextInput type="number" min={0} value={f.pay_amount ?? ''} onChange={setNum('pay_amount')} />
              </Field>
              <Field label="Amount is per">
                <Select value={f.pay_period} onChange={set('pay_period')}>
                  <option value="month">Month</option>
                  <option value="year">Year (package)</option>
                </Select>
              </Field>
            </>
          )}
          {mode === 'pay_to_train' && (
            <>
              <Field label="Training fee the candidate pays (₹)" required>
                <TextInput type="number" min={0} value={f.training_fee ?? ''} onChange={setNum('training_fee')} />
              </Field>
              <Field label="Training lasts (months)" required>
                <TextInput type="number" min={1} max={36} value={f.training_months ?? ''} onChange={setNum('training_months')} />
              </Field>
              <Field label="Company pays per month after training (₹)" required>
                <TextInput type="number" min={0} value={f.post_training_amount ?? ''} onChange={setNum('post_training_amount')} />
              </Field>
              <Field label="Company pay starts on" hint="Worked out from the start date and the training months, change it if needed">
                <TextInput type="date" value={f.post_training_from ?? ''} onChange={setDate('post_training_from')} />
              </Field>
            </>
          )}
          <div className="sm:col-span-2">
            <Field label="Extra note about pay" hint="Optional. Added after the pay lines, e.g. fee instalments, bonus, reimbursements">
              <TextArea rows={2} value={f.compensation_note} onChange={set('compensation_note')} />
            </Field>
          </div>
        </div>

        <div className={section}>Job description</div>
        <Field label="Printed after the letter, and available on its own as a JD profile">
          <TextArea rows={10} value={f.jd} onChange={set('jd')} />
        </Field>
        <div className="mt-1">
          <button
            type="button"
            className="text-xs font-medium text-blue-600 hover:underline"
            onClick={() => {
              const tpl = templates.find((t) => t.id === f.role_template_id);
              if (!tpl) return toast('Choose a role first', 'error');
              const jd = buildJd(tpl, f.level as Level);
              auto.current.jd = jd;
              setF({ ...f, jd });
            }}
          >
            Reload from the role template
          </button>
        </div>

        <div className={section}>Terms and conditions</div>
        <Field label="Printed on the letter. One term per line">
          <TextArea rows={9} value={f.terms} onChange={set('terms')} />
        </Field>
        <div className="mt-1">
          <button
            type="button"
            className="text-xs font-medium text-blue-600 hover:underline"
            onClick={() => {
              const terms = defaultTerms(type, f.probation_months, f.notice_days);
              auto.current.terms = terms;
              setF({ ...f, terms });
            }}
          >
            Reset to the standard terms
          </button>
        </div>

        <div className={section}>Signed by</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <TextInput value={f.signatory_name} onChange={set('signatory_name')} />
          </Field>
          <Field label="Designation">
            <TextInput value={f.signatory_designation} onChange={set('signatory_designation')} />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sign} onChange={(e) => setSign(e.target.value as SignMode)} className="!w-auto !py-2 text-sm">
            <option value="signed">With signature and seal</option>
            <option value="blank">Blank, for an original signature</option>
          </Select>
          <Button variant="secondary" onClick={() => download('offer')} loading={busy === 'offer'}>
            <Download size={15} /> Offer letter
          </Button>
          <Button variant="secondary" onClick={() => download('jd')} loading={busy === 'jd'}>
            <FileText size={15} /> JD profile
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={() => save(false)} loading={busy === 'save'}>
            Save
          </Button>
          {(!saved || saved.status === 'draft') && (
            <Button onClick={() => save(true)} loading={busy === 'issue'}>
              Save and issue
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
