import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type AccessMap = Map<string, boolean>;

let cache: AccessMap | null = null;
let inflight: Promise<AccessMap> | null = null;

async function fetchModuleAccess(): Promise<AccessMap> {
  const { data } = await supabase.from('instructor_module_access').select('module_key, visible');
  const map: AccessMap = new Map();
  for (const row of data ?? []) map.set(row.module_key, row.visible);
  return map;
}

/** Which admin modules are currently visible to the instructor role, per super-admin configuration. Pass `enabled: false` (e.g. on student pages) to skip the fetch entirely. */
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

/** Defaults to visible when a module has no row yet (e.g. still loading, or newly added and not yet configured). */
export function isModuleVisible(access: AccessMap | null, moduleKey: string): boolean {
  return access?.get(moduleKey) ?? true;
}
