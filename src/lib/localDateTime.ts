/** `<input type="datetime-local">` wants/gives a naive "YYYY-MM-DDTHH:mm" string in the
 * viewer's own local time, with no timezone info — so it has to be converted explicitly
 * at both ends instead of passed through, or the value silently shifts across the
 * client/server boundary (the server has no reason to share the viewer's timezone). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
