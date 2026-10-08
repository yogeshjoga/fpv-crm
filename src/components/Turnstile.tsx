import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };
  }
}

export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '';
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const el = existing ?? Object.assign(document.createElement('script'), { src: SRC, async: true });
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => reject(new Error('Could not load the human check')));
    if (!existing) document.head.appendChild(el);
  });
}

/** Cloudflare Turnstile "are you human" check. Renders nothing until VITE_TURNSTILE_SITE_KEY is set. */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let widget: string | undefined;
    let gone = false;
    loadScript()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return;
        widget = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t: string) => onToken(t),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      gone = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return TURNSTILE_SITE_KEY ? <div ref={box} /> : null;
}
