import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type AccessLevel = 'none' | 'read' | 'write';
type AccessMap = Map<string, AccessLevel>;

let cache: AccessMap | null = null;
let inflight: Promise<AccessMap> | null = null;

async function fetchModuleAccess(): Promise<AccessMap> {
  const { data } = await supabase.from('instructor_module_access').select('module_key, access_level');
  const map: AccessMap = new Map();
  for (const row of data ?? []) map.set(row.module_key, row.access_level as AccessLevel);
  return map;
}

/** Which admin modules are visible/writable to the instructor role, per super-admin configuration. Pass `enabled: false` (e.g. on student pages) to skip the fetch entirely. */
export function useInstructorModuleAccess(enabled = true) {
  const [data, setData] = useState<AccessMap | null>(cache);
  const [loading, setLoading] = useState(enabled && !cache);

  useEffect(() => {
    if (!enabled) return;
    if (cache) {
      setData(cache);
      setLoading(false);
      return;
    }
    let live = true;
    if (!inflight) inflight = fetchModuleAccess();
    inflight.then((map) => {
      if (!live) return;
      cache = map;
      setData(map);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  return { data, loading };
}

/** Call after writing instructor_module_access so the next fetch (e.g. a fresh page load) picks up the change. */
export function invalidateModuleAccessCache() {
  cache = null;
  inflight = null;
}

/** Defaults to 'read' when a module has no row yet (still loading, or newly added and not yet configured) — read-only is the safe default, not full access. */
export function getAccessLevel(access: AccessMap | null, moduleKey: string): AccessLevel {
  return access?.get(moduleKey) ?? 'read';
}

export function isModuleVisible(access: AccessMap | null, moduleKey: string): boolean {
  return getAccessLevel(access, moduleKey) !== 'none';
}

export function isModuleWritable(access: AccessMap | null, moduleKey: string): boolean {
  return getAccessLevel(access, moduleKey) === 'write';
}
