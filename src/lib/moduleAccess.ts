import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type AccessLevel = 'none' | 'read' | 'write';
/** Roles whose section access a super admin can configure. Super admins always have everything. */
export type ConfigurableRole = 'instructor' | 'coordinator' | 'admin' | 'student';
export const CONFIGURABLE_ROLES: ConfigurableRole[] = ['instructor', 'coordinator', 'admin', 'student'];

type AccessMap = Map<string, AccessLevel>;

const cache = new Map<string, AccessMap>();
const inflight = new Map<string, Promise<AccessMap>>();

const isConfigurable = (role: string | null | undefined): role is ConfigurableRole =>
  !!role && (CONFIGURABLE_ROLES as string[]).includes(role);

async function fetchRoleAccess(role: ConfigurableRole): Promise<AccessMap> {
  const { data } = await supabase.from('role_module_access').select('module_key, access_level').eq('role', role);
  const map: AccessMap = new Map();
  for (const row of data ?? []) map.set(row.module_key, row.access_level as AccessLevel);
  return map;
}

/**
 * The section access configured for one role. Pass the role you want to evaluate (a user's own
 * role, or the role a super admin is previewing). Roles that aren't configurable (super admin) and
 * `null` skip the fetch and return no data.
 */
export function useModuleAccess(role: string | null | undefined) {
  const configurable = isConfigurable(role);
  const [data, setData] = useState<AccessMap | null>(configurable ? cache.get(role) ?? null : null);
  const [loading, setLoading] = useState(configurable && !cache.has(role));

  useEffect(() => {
    if (!isConfigurable(role)) {
      setData(null);
      setLoading(false);
      return;
    }
    const hit = cache.get(role);
    if (hit) {
      setData(hit);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    let job = inflight.get(role);
    if (!job) {
      job = fetchRoleAccess(role);
      inflight.set(role, job);
    }
    job.then((map) => {
      cache.set(role, map);
      inflight.delete(role);
      if (!live) return;
      setData(map);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [role]);

  return { data, loading };
}

/** Call after changing role_module_access so the next read (e.g. a fresh page load) picks it up. */
export function invalidateModuleAccessCache() {
  cache.clear();
  inflight.clear();
}

/** Defaults to 'read' when a section has no row yet (still loading, or added since and not configured) — read-only is the safe default, not full access. */
export function getAccessLevel(access: AccessMap | null, moduleKey: string): AccessLevel {
  return access?.get(moduleKey) ?? 'read';
}

export function isModuleVisible(access: AccessMap | null, moduleKey: string): boolean {
  return getAccessLevel(access, moduleKey) !== 'none';
}

export function isModuleWritable(access: AccessMap | null, moduleKey: string): boolean {
  return getAccessLevel(access, moduleKey) === 'write';
}
