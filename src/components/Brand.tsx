import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * The EgireRobotics logo, always the real logo image: the one uploaded under Company Settings (so changing it there
 * changes it everywhere), with a copy of the same file shipped at /logo.png so the first paint never waits.
 */
const KEY = 'brand.logo';
const FALLBACK = '/logo.png';
let current: string | null = null;
let pending: Promise<string | null> | null = null;

function remembered(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function load(): Promise<string | null> {
  pending ??= (async () => {
    const { data } = await supabase.rpc('public_branding' as never);
    const url = (data as unknown as { logo_url: string | null }[] | null)?.[0]?.logo_url ?? null;
    if (url && /^https?:\/\//i.test(url)) {
      current = url;
      try {
        localStorage.setItem(KEY, url);
      } catch {
        /* the cache is only a speed-up */
      }
      return url;
    }
    return null;
  })().catch(() => null);
  return pending;
}

export function useLogoUrl(): string {
  const [url, setUrl] = useState<string>(current ?? remembered() ?? FALLBACK);
  useEffect(() => {
    let live = true;
    void load().then((u) => live && u && setUrl(u));
    return () => {
      live = false;
    };
  }, []);
  return url;
}

export function Logo({ height = 36, className = '' }: { height?: number; className?: string }) {
  const url = useLogoUrl();
  return (
    <img
      src={url}
      alt="EgireRobotics"
      draggable={false}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith(FALLBACK)) e.currentTarget.src = FALLBACK;
      }}
      style={{ height, width: 'auto' }}
      className={`block select-none ${className}`}
    />
  );
}
