// Scoring rules for a composite assessment. This file is copied verbatim to
// supabase/functions/_shared/assessment.ts so the app, the report card and the certificate
// function can never disagree. Keep it free of imports.
//
// The rule: every module must be cleared on its own. A student who fails any one module has not
// cleared the assessment, however high the total is.

export type ModuleKey = 'online' | 'viva' | 'simulation' | 'piloting';

/** Order and names shown to students (report card, emails). */
export const MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'online', label: 'Online exam' },
  { key: 'viva', label: 'Viva' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'piloting', label: 'Free flight' },
];

export interface Scheme {
  max: Record<ModuleKey, number>;
  /** Minimum marks (not %) needed to clear each module. */
  pass: Record<ModuleKey, number>;
  /** Total needed for Merit, on top of clearing every module. */
  meritMin: number;
  /**
   * Modules that are not marked. They carry a short description instead (e.g. "Moderate piloting skills"),
   * need no marks, and count towards neither the total nor the cleared check.
   */
  unscored?: Partial<Record<ModuleKey, string>>;
}

export interface ModuleResult {
  key: ModuleKey;
  label: string;
  marks: number;
  max: number;
  pass: number;
  cleared: boolean;
  /** Set for a module that is not marked: what the report card shows instead of marks. */
  note?: string;
}

export interface Evaluation {
  modules: ModuleResult[];
  total: number;
  max: number;
  /** Cleared every module. */
  clearedAll: boolean;
  /** Labels of the modules not cleared. */
  failed: string[];
  /** Merit needs every module cleared AND the merit total; anything else is Participation. */
  result: 'Merit' | 'Participation';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Cleared if the marks reach the pass mark (tiny epsilon so 11.25 vs 11.2499999 can't flip it). */
export function isCleared(marks: number, pass: number): boolean {
  return marks + 1e-9 >= pass;
}

/**
 * `marks` are the raw marks per module (the online exam's raw value is score% × its max / 100,
 * unrounded). Returns null until all four modules have marks.
 */
export function evaluate(scheme: Scheme, marks: Partial<Record<ModuleKey, number>>): Evaluation | null {
  const note = (key: ModuleKey) => scheme.unscored?.[key];
  const scored = MODULES.filter((m) => !note(m.key));
  if (scored.some((m) => marks[m.key] === undefined || marks[m.key] === null || Number.isNaN(marks[m.key]))) return null;
  const modules: ModuleResult[] = MODULES.map((m) =>
    note(m.key)
      ? { key: m.key, label: m.label, marks: 0, max: 0, pass: 0, cleared: true, note: note(m.key) }
      : {
          key: m.key,
          label: m.label,
          marks: round2(marks[m.key]!),
          max: scheme.max[m.key],
          pass: scheme.pass[m.key],
          cleared: isCleared(marks[m.key]!, scheme.pass[m.key]),
        },
  );
  const total = round2(scored.reduce((sum, m) => sum + marks[m.key]!, 0));
  const max = round2(scored.reduce((sum, m) => sum + scheme.max[m.key], 0));
  const failed = modules.filter((m) => !m.cleared).map((m) => m.label);
  const clearedAll = failed.length === 0;
  return { modules, total, max, clearedAll, failed, result: clearedAll && total + 1e-9 >= scheme.meritMin ? 'Merit' : 'Participation' };
}
