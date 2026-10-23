import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { invokeFn } from '../../lib/functions';
import { Logo } from '../../components/Brand';
import { parseAnswers, moduleLine } from '../../lib/quoteRequests';
import { Button, Checkbox, Field, Select, Spinner, TextArea, TextInput } from '../../components/ui/kit';

interface Choice { key: string; label: string }
interface Option { key: string; label: string; kind: 'one' | 'many'; choices: Choice[]; required?: boolean }
interface Module {
  key: string; title: string; blurb: string; inPerson?: boolean; useDays: boolean; minDays: number; defaultDays: number;
  minHours: number; defaultHours: number; hoursChoices?: number[]; options: Option[];
}
interface Catalog { modules: Module[]; audience: Choice[]; experience: Choice[]; mode: Choice[] }
interface Loaded {
  locked: boolean;
  status: string;
  contact: { name: string; organisation: string; email: string; phone: string };
  answers: unknown;
  catalog: Catalog;
}
interface Pick { selected: boolean; days: string; hours: string; options: Record<string, string | string[]> }
interface State {
  name: string; designation: string; organisation: string; email: string; phone: string;
  participants: string; audience: string; experience: string; mode: string; venue: string; start: string; end: string; flexible: boolean; certificates: boolean;
  picks: Record<string, Pick>; budget: string; notes: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // A private link: keep it out of search results.
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex,nofollow';
    document.head.appendChild(m);
    return () => void m.remove();
  }, []);
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex items-center justify-center"><Logo height={40} /></div>
        <div className="rounded-[2rem] border border-white/70 bg-white/60 p-6 shadow-[0_8px_40px_rgb(0,0,0,0.06)] backdrop-blur-2xl sm:p-8">{children}</div>
        <p className="mt-4 text-center text-xs text-neutral-500">Your answers go only to the EgireRobotics team.</p>
      </div>
    </div>
  );
}

const blankPick = (m: Module): Pick => ({ selected: false, days: m.useDays ? String(m.defaultDays) : '', hours: String(m.defaultHours), options: {} });

function initialState(data: Loaded): State {
  const cat = data.catalog;
  const prev = parseAnswers(data.answers);
  const picks: Record<string, Pick> = {};
  for (const m of cat.modules) picks[m.key] = blankPick(m);
  if (prev) {
    for (const pm of prev.modules) {
      const m = cat.modules.find((x) => x.key === pm.key);
      if (!m) continue;
      const options: Record<string, string | string[]> = {};
      for (const po of pm.options) {
        const o = m.options.find((x) => x.key === po.key);
        if (!o) continue;
        const keys = po.values.map((v) => o.choices.find((c) => c.label === v)?.key).filter((k): k is string => !!k);
        options[o.key] = o.kind === 'many' ? keys : keys[0] ?? '';
      }
      picks[m.key] = { selected: true, days: pm.days === null ? '' : String(pm.days), hours: String(pm.hours), options };
    }
  }
  const pick = (list: Choice[], label?: string) => list.find((c) => c.label === label)?.key ?? '';
  return {
    name: prev?.contact.name ?? data.contact.name, designation: prev?.contact.designation ?? '', organisation: prev?.contact.organisation ?? data.contact.organisation,
    email: prev?.contact.email ?? data.contact.email, phone: prev?.contact.phone ?? data.contact.phone,
    participants: prev ? String(prev.event.participants) : '', audience: pick(cat.audience, prev?.event.audience), experience: pick(cat.experience, prev?.event.experience),
    mode: pick(cat.mode, prev?.event.mode) || cat.mode[0]?.key || '', venue: prev?.event.venue ?? '', start: prev?.event.start ?? '', end: prev?.event.end ?? '',
    flexible: prev?.event.flexible ?? false, certificates: prev?.event.certificates ?? true, picks, budget: prev?.budget ?? '', notes: prev?.notes ?? '',
  };
}

export function QuoteRequest() {
  const { token } = useParams();
  const [data, setData] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [website, setWebsite] = useState(''); // hidden trap field: people never see it, bots fill it

  useEffect(() => {
    let live = true;
    invokeFn<Loaded>('quote-request', { action: 'load', token })
      .then((d) => {
        if (!live) return;
        setData(d);
        setS(initialState(d));
      })
      .catch((e) => live && setProblem(e instanceof Error ? e.message : 'This link is not valid any more.'));
    return () => {
      live = false;
    };
  }, [token]);

  const cat = data?.catalog;
  const set = <K extends keyof State>(k: K, v: State[K]) => {
    setError(null);
    setS((x) => (x ? { ...x, [k]: v } : x));
  };
  const setPick = (key: string, patch: Partial<Pick>) => set('picks', { ...s!.picks, [key]: { ...s!.picks[key], ...patch } });
  const setOpt = (mKey: string, oKey: string, v: string | string[]) => setPick(mKey, { options: { ...s!.picks[mKey].options, [oKey]: v } });

  const online = useMemo(() => s?.mode === 'online', [s?.mode]);
  const chosen = cat && s ? cat.modules.filter((m) => s.picks[m.key].selected) : [];
  const totals = chosen.reduce((a, m) => ({ days: a.days + (m.useDays ? Number(s!.picks[m.key].days) || 0 : 0), hours: a.hours + (Number(s!.picks[m.key].hours) || 0) }), { days: 0, hours: 0 });

  // Mirrors the checks the server makes, so the person sees what to fix before sending.
  const check = (): string | null => {
    if (!cat || !s) return null;
    if (!s.name.trim()) return 'Please enter your name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email.trim())) return 'Please enter a valid email address so we can send the quotation.';
    if (!s.organisation.trim()) return 'Please enter your college, club or company.';
    if (!(Number(s.participants) >= 1)) return 'Please enter how many participants there will be.';
    if (!s.audience || !s.experience) return 'Please say who the participants are and how much they have flown.';
    if (!online && !s.venue.trim()) return 'Please tell us the venue or city.';
    if (s.start && s.end && s.end < s.start) return 'The end date cannot be before the start date.';
    if (!chosen.length) return 'Please choose at least one thing you would like us to cover.';
    for (const m of chosen) {
      const p = s.picks[m.key];
      if (m.inPerson && online) return `${m.title} needs an in-person session. Choose in person or hybrid, or remove it.`;
      if (m.useDays && !(Number(p.days) >= m.minDays)) return `${m.title}: at least ${m.minDays} day${m.minDays === 1 ? '' : 's'}.`;
      if (!(Number(p.hours) >= m.minHours)) return `${m.title}: at least ${m.minHours} hours.`;
      if (m.useDays && Number(p.hours) > Number(p.days) * 10) return `${m.title}: ${p.hours} hours do not fit in ${p.days} day${Number(p.days) === 1 ? '' : 's'}. Add days or reduce the hours.`;
      for (const o of m.options) {
        const v = p.options[o.key];
        if (o.required && (Array.isArray(v) ? !v.length : !v)) return `${m.title}: please choose "${o.label}".`;
      }
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problemFound = check();
    if (problemFound) return setError(problemFound);
    if (!s) return;
    setBusy(true);
    setError(null);
    try {
      const modules: Record<string, unknown> = {};
      for (const m of chosen) {
        const p = s.picks[m.key];
        modules[m.key] = { selected: true, days: m.useDays ? Number(p.days) : undefined, hours: Number(p.hours), options: p.options };
      }
      await invokeFn('quote-request', {
        action: 'submit',
        token,
        website,
        answers: {
          contact: { name: s.name, designation: s.designation, organisation: s.organisation, email: s.email, phone: s.phone },
          event: { participants: Number(s.participants), audience: s.audience, experience: s.experience, mode: s.mode, venue: s.venue, start: s.start, end: s.end, flexible: s.flexible, certificates: s.certificates },
          modules,
          budget: s.budget,
          notes: s.notes,
        },
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your answers. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (problem) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-semibold text-neutral-900">This link is not available</h1>
        <p className="mt-2 text-sm text-neutral-600">{problem}</p>
      </Shell>
    );
  }
  if (!data || !cat || !s) return <Shell><Spinner /></Shell>;

  if (data.locked) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="text-green-500" size={40} />
          <h1 className="font-display text-xl font-semibold text-neutral-900">Your quotation is being prepared</h1>
          <p className="max-w-md text-sm text-neutral-600">We already have your requirements and the quotation is made from them. If you want to change something, please reply to the EgireRobotics team directly.</p>
        </div>
      </Shell>
    );
  }

  if (done) {
    const summary = chosen.map((m) => moduleLine({ key: m.key, title: m.title, days: m.useDays ? Number(s.picks[m.key].days) : null, hours: Number(s.picks[m.key].hours), options: [] }));
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="text-green-500" size={40} />
          <h1 className="font-display text-xl font-semibold text-neutral-900">Thank you, we have your requirements</h1>
          <p className="max-w-md text-sm text-neutral-600">The EgireRobotics team will prepare your quotation and send it to {s.email}.</p>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">{summary.map((line) => <li key={line}>{line}</li>)}</ul>
          <button type="button" className="mt-3 text-sm font-medium text-blue-600 hover:underline" onClick={() => setDone(false)}>Change my answers</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-2xl font-semibold text-neutral-900">What would you like us to cover?</h1>
      <p className="mt-2 text-sm text-neutral-600">Tell us what you expect from the FPV training and we will prepare a quotation for you. It takes about five minutes, and there is nothing to pay now.</p>

      <form onSubmit={submit} className="mt-6 space-y-8">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" />

        <Block title="1. About you">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" required><TextInput value={s.name} maxLength={120} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Your role"><TextInput value={s.designation} maxLength={160} onChange={(e) => set('designation', e.target.value)} placeholder="e.g. Vice President, ECE Club" /></Field>
            <div className="sm:col-span-2"><Field label="College, club or company" required><TextInput value={s.organisation} maxLength={200} onChange={(e) => set('organisation', e.target.value)} /></Field></div>
            <Field label="Email" required hint="The quotation is sent here."><TextInput type="email" value={s.email} maxLength={200} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Phone" hint="Optional."><TextInput value={s.phone} maxLength={30} onChange={(e) => set('phone', e.target.value)} /></Field>
          </div>
        </Block>

        <Block title="2. Your group">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="How many participants?" required><TextInput inputMode="numeric" value={s.participants} onChange={(e) => set('participants', e.target.value.replace(/\D/g, ''))} placeholder="e.g. 30" /></Field>
            <Field label="Who are they?" required>
              <Select value={s.audience} onChange={(e) => set('audience', e.target.value)}><option value="" disabled>Choose</option>{cat.audience.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select>
            </Field>
            <Field label="How much have they flown?" required>
              <Select value={s.experience} onChange={(e) => set('experience', e.target.value)}><option value="" disabled>Choose</option>{cat.experience.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select>
            </Field>
            <Field label="How should it be held?" required>
              <Select value={s.mode} onChange={(e) => set('mode', e.target.value)}>{cat.mode.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select>
            </Field>
            <div className="sm:col-span-2"><Field label={online ? 'City (optional)' : 'Venue or city'} required={!online}><TextInput value={s.venue} maxLength={240} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. UIT, Karnavati University, Gandhinagar" /></Field></div>
            <Field label="Preferred start date"><TextInput type="date" value={s.start} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set('start', e.target.value)} /></Field>
            <Field label="Preferred end date"><TextInput type="date" value={s.end} min={s.start || undefined} onChange={(e) => set('end', e.target.value)} /></Field>
            <div className="space-y-2 sm:col-span-2">
              <Checkbox label="The dates are flexible" checked={s.flexible} onChange={(e) => set('flexible', e.target.checked)} />
              <Checkbox label="We would like a participation certificate for every participant" checked={s.certificates} onChange={(e) => set('certificates', e.target.checked)} />
            </div>
          </div>
        </Block>

        <Block title="3. What should we cover?" note="Choose as many as you like. Each one shows its minimum days and hours.">
          <div className="space-y-3">
            {cat.modules.map((m) => {
              const p = s.picks[m.key];
              const blocked = !!m.inPerson && online;
              return (
                <div key={m.key} className={`rounded-2xl border p-4 transition-colors ${p.selected ? 'border-blue-300 bg-blue-50/60' : 'border-white/70 bg-white/60'} ${blocked ? 'opacity-60' : ''}`}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" className="mt-1 h-4 w-4 rounded border-neutral-300 text-blue-600" checked={p.selected} disabled={blocked} onChange={(e) => setPick(m.key, { selected: e.target.checked })} />
                    <span>
                      <span className="block font-medium text-neutral-900">{m.title}</span>
                      <span className="block text-sm text-neutral-600">{m.blurb}</span>
                      {m.inPerson && <span className="mt-1 block text-xs text-neutral-500">Needs an in-person session.</span>}
                    </span>
                  </label>
                  {p.selected && (
                    <div className="mt-4 space-y-4 border-t border-black/5 pt-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {m.useDays && (
                          <Field label="Days" hint={`Minimum ${m.minDays}`}>
                            <TextInput inputMode="numeric" value={p.days} onChange={(e) => setPick(m.key, { days: e.target.value.replace(/\D/g, '') })} />
                          </Field>
                        )}
                        <Field label="Total hours" hint={m.hoursChoices ? 'Theory is kept short by default.' : `Minimum ${m.minHours}`}>
                          {m.hoursChoices ? (
                            <Select value={p.hours} onChange={(e) => setPick(m.key, { hours: e.target.value })}>{m.hoursChoices.map((h) => <option key={h} value={h}>{h} hours{h === m.minHours ? ' (minimal)' : ''}</option>)}</Select>
                          ) : (
                            <TextInput inputMode="numeric" value={p.hours} onChange={(e) => setPick(m.key, { hours: e.target.value.replace(/\D/g, '') })} />
                          )}
                        </Field>
                      </div>
                      {m.options.map((o) => {
                        const v = p.options[o.key];
                        return (
                          <div key={o.key}>
                            <p className="mb-1.5 text-sm font-medium text-neutral-700">{o.label}{o.required && <span className="text-red-500"> *</span>}</p>
                            {o.kind === 'one' ? (
                              <div className="flex flex-wrap gap-2">
                                {o.choices.map((c) => (
                                  <button key={c.key} type="button" onClick={() => setOpt(m.key, o.key, c.key)} className={`rounded-full border px-3 py-1.5 text-sm ${v === c.key ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500'}`}>{c.label}</button>
                                ))}
                              </div>
                            ) : (
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                {o.choices.map((c) => {
                                  const list = Array.isArray(v) ? v : [];
                                  return <Checkbox key={c.key} label={c.label} checked={list.includes(c.key)} onChange={(e) => setOpt(m.key, o.key, e.target.checked ? [...list, c.key] : list.filter((x) => x !== c.key))} />;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {chosen.length > 0 && (
            <p className="mt-3 rounded-2xl bg-white/70 px-4 py-2.5 text-sm text-neutral-700">
              So far: <b>{chosen.length}</b> area{chosen.length === 1 ? '' : 's'}, about <b>{totals.days}</b> training day{totals.days === 1 ? '' : 's'} and <b>{totals.hours}</b> hours in total.
            </p>
          )}
        </Block>

        <Block title="4. Anything else?">
          <div className="space-y-4">
            <Field label="Budget" hint="Optional. It helps us suggest a plan that fits."><TextInput value={s.budget} maxLength={200} onChange={(e) => set('budget', e.target.value)} placeholder="e.g. around ₹50,000" /></Field>
            <Field label="Notes for us" hint="Optional."><TextArea rows={4} maxLength={1500} value={s.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>
        </Block>

        {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">Send my requirements</Button>
      </form>
    </Shell>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {note && <p className="mt-0.5 text-sm text-neutral-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
