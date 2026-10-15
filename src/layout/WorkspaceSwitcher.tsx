import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown } from 'lucide-react';
import type { Workspace } from './Shell';

/** Sidebar dropdown that moves between the CRM, the website's content and the online store. */
export function WorkspaceSwitcher({
  workspaces,
  active,
  homeFor,
  onNavigate,
}: {
  workspaces: Workspace[];
  active: Workspace;
  /** First page of a workspace the signed-in user can open. */
  homeFor: (w: Workspace) => string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (workspaces.length < 2) return null;

  const choose = (w: Workspace) => {
    setOpen(false);
    if (w.key !== active.key) {
      navigate(homeFor(w));
      onNavigate?.();
    }
  };

  return (
    <div ref={root} className="relative px-3 pt-3">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Workspace: ${active.label}. Switch workspace`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-left shadow-sm transition-colors hover:bg-white"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1a1a1a] text-white">
          <active.icon size={16} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-semibold text-neutral-900">{active.label}</span>
          <span className="block truncate text-[11px] text-neutral-500">{active.description}</span>
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-neutral-400" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Workspaces"
          className="absolute inset-x-3 top-full z-50 mt-1.5 rounded-2xl border border-white/70 bg-white/95 p-1.5 shadow-xl backdrop-blur-2xl"
        >
          {workspaces.map((w) => {
            const selected = w.key === active.key;
            return (
              <li key={w.key} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => choose(w)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    selected ? 'bg-black/[0.05]' : 'hover:bg-black/[0.04]'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      selected ? 'bg-[#1a1a1a] text-white' : 'bg-white text-neutral-700 shadow-sm ring-1 ring-black/5'
                    }`}
                  >
                    <w.icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-sm font-medium text-neutral-900">{w.label}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{w.description}</span>
                  </span>
                  {selected && <Check size={15} className="shrink-0 text-neutral-900" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
