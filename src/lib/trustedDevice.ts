/**
 * "Don't ask for the two-step code again on this device."
 * The secret device token lives in an HttpOnly cookie managed by /api/device, so page scripts never see it.
 */

/** A short name for this browser, shown in the list of trusted devices. */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'device';
  return `${browser} on ${os}`;
}

async function call(action: 'trust' | 'restore', accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('/api/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action, access_token: accessToken, label: action === 'trust' ? deviceLabel() : undefined }),
    });
    if (!res.ok) return false;
    const out = (await res.json()) as { trusted?: boolean };
    return out.trusted === true;
  } catch {
    return false;
  }
}

/** Right after the code was entered: remember this browser. */
export const trustThisDevice = (accessToken: string) => call('trust', accessToken);

/** After a password sign-in: if this browser was trusted before, mark this session trusted. */
export const restoreTrust = (accessToken: string) => call('restore', accessToken);
