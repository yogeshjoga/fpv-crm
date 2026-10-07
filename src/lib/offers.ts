import type { Tables } from './database.types';

export type Offer = Tables<'careers_offers'>;
export type RoleTemplate = Tables<'careers_role_templates'>;
export type Level = 'intern' | 'fresher' | 'experienced';
export type CompMode = 'paid' | 'unpaid' | 'pay_to_train';
export type OfferStatus = 'draft' | 'issued' | 'accepted' | 'declined' | 'withdrawn';
export type EmploymentType = 'internship' | 'full_time' | 'part_time' | 'contract';

export const LEVEL_LABEL: Record<Level, string> = { intern: 'Intern', fresher: 'Fresher', experienced: 'Experienced' };
export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  internship: 'Internship',
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
};
export const COMP_LABEL: Record<CompMode, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  pay_to_train: 'Candidate pays for training, then the company pays monthly',
};
export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};
export const OFFER_STATUS_TONE: Record<OfferStatus, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  draft: 'neutral',
  issued: 'blue',
  accepted: 'green',
  declined: 'red',
  withdrawn: 'neutral',
};

export const DEFAULT_DESIGNATION = 'Founder, EgireRobotics · DGCA certified pilot';

/** An intern is an internship; fresher and experienced are full-time unless the admin changes it. */
export const employmentFor = (level: Level): EmploymentType => (level === 'intern' ? 'internship' : 'full_time');

export function levelNotes(t: Pick<RoleTemplate, 'level_notes'>): Record<Level, string> {
  const n = (t.level_notes && typeof t.level_notes === 'object' && !Array.isArray(t.level_notes) ? t.level_notes : {}) as Record<string, unknown>;
  return { intern: String(n.intern ?? ''), fresher: String(n.fresher ?? ''), experienced: String(n.experienced ?? '') };
}

/** The job description for one role at one level: the role's text followed by what is different at that level. */
export function buildJd(t: Pick<RoleTemplate, 'jd' | 'level_notes'>, level: Level): string {
  const note = levelNotes(t)[level].trim();
  const base = t.jd.trim();
  if (!note) return base;
  return `${base}\n\nAt ${LEVEL_LABEL[level].toLowerCase()} level\n- ${note}`;
}

export const money = (n: number | null | undefined) => (n === null || n === undefined ? '' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const addMonths = (d: string, months: number) => {
  const x = new Date(`${d}T00:00:00`);
  x.setMonth(x.getMonth() + months);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export { addMonths };

/** Default terms and conditions for a letter. Admins edit this text on each offer. */
export function defaultTerms(type: EmploymentType, probationMonths: number | null, noticeDays: number | null): string {
  const lines: string[] = [
    'This offer is subject to verification of your identity, educational records and any other documents we ask for.',
    'You will follow EgireRobotics policies, safety procedures and the DGCA rules that apply to drone operations. Flying and testing are done only as approved by the company.',
    'You will keep all company information, designs, code, data and customer details confidential during and after your engagement.',
    'All work you create for the company, including designs, code, models and documents, belongs to EgireRobotics.',
    'You will keep to the working hours and conduct standards of the company and take care of the equipment given to you.',
  ];
  if (type === 'internship') {
    lines.push('This is a fixed-term internship for learning and experience. It does not guarantee a job at EgireRobotics. On successful completion you will receive an internship completion certificate.');
    lines.push(`Either side may end the internship by giving ${noticeDays ?? 7} days notice. The company may end it at once for misconduct.`);
  } else {
    if (probationMonths) lines.push(`Your first ${probationMonths} month${probationMonths === 1 ? '' : 's'} are a probation period. We will confirm your employment in writing once probation is completed satisfactorily.`);
    lines.push(`Either side may end the employment by giving ${noticeDays ?? 30} days notice. The company may end it at once for misconduct.`);
  }
  lines.push('This letter is valid only when signed by an authorised signatory of EgireRobotics. Please sign and return a copy to accept.');
  return lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
}

/** The pay section of the letter, as paragraphs. Built from the offer so it always matches the fields. */
export function compensationParagraphs(o: Pick<Offer, 'compensation_mode' | 'pay_amount' | 'pay_period' | 'training_fee' | 'training_months' | 'post_training_amount' | 'post_training_from' | 'compensation_note' | 'employment_type'>): string[] {
  const out: string[] = [];
  const word = o.employment_type === 'internship' ? 'stipend' : 'salary';
  if (o.compensation_mode === 'paid') {
    if (o.pay_amount !== null && o.pay_amount !== undefined) {
      if (o.pay_period === 'year') out.push(`You will receive a ${word} of ${money(o.pay_amount)} per year (${money(Math.round((Number(o.pay_amount) / 12) * 100) / 100)} per month), paid monthly.`);
      else out.push(`You will receive a ${word} of ${money(o.pay_amount)} per month${Number(o.pay_amount) > 0 && o.employment_type !== 'internship' ? ` (${money(Number(o.pay_amount) * 12)} per year)` : ''}, paid monthly.`);
      out.push('Statutory deductions, if any apply, will be made as per law.');
    } else out.push('The amount you will be paid is as communicated to you in writing.');
  } else if (o.compensation_mode === 'unpaid') {
    out.push(`This is an unpaid ${o.employment_type === 'internship' ? 'internship' : 'engagement'}. There is no ${word} or salary during this period.`);
  } else {
    const months = o.training_months ?? null;
    out.push(
      `The first ${months ? `${months} month${months === 1 ? '' : 's'}` : 'part'} of your engagement is a training phase. For this training you pay EgireRobotics a training fee of ${o.training_fee !== null && o.training_fee !== undefined ? money(o.training_fee) : 'the amount agreed with you'}.`,
    );
    const payLine = o.post_training_amount !== null && o.post_training_amount !== undefined ? money(o.post_training_amount) : 'the amount agreed with you';
    out.push(
      `When the training is completed successfully and your work is satisfactory, EgireRobotics will pay you ${payLine} every month${o.post_training_from ? ` starting from ${fmtDate(o.post_training_from)}` : ''}.`,
    );
  }
  if (o.compensation_note.trim()) out.push(o.compensation_note.trim());
  return out;
}

export const emptyOffer = (): Omit<Offer, 'id' | 'offer_no' | 'created_at' | 'updated_at' | 'created_by' | 'responded_at'> => ({
  application_id: null,
  role_template_id: null,
  candidate_name: '',
  candidate_email: '',
  role_title: '',
  level: 'intern',
  employment_type: 'internship',
  department: '',
  work_mode: 'onsite',
  location: '',
  reporting_to: '',
  working_hours: '',
  issued_on: new Date().toISOString().slice(0, 10),
  valid_until: null,
  start_date: null,
  end_date: null,
  probation_months: null,
  notice_days: null,
  compensation_mode: 'paid',
  pay_amount: null,
  pay_period: 'month',
  training_fee: null,
  training_months: null,
  post_training_amount: null,
  post_training_from: null,
  compensation_note: '',
  jd: '',
  terms: '',
  signatory_name: '',
  signatory_designation: DEFAULT_DESIGNATION,
  status: 'draft',
});
