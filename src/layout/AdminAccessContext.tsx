import { createContext, useContext } from 'react';

export interface AdminAccessValue {
  /** True when the effective role right now is instructor — really, or via a super admin's "Instructor view" preview. */
  restricted: boolean;
  /** Whether write actions (buttons, forms, uploads) for this module should render right now. Always true for a real super admin. */
  canWrite: (moduleKey: string) => boolean;
}

const defaultValue: AdminAccessValue = { restricted: false, canWrite: () => true };

const AdminAccessContext = createContext<AdminAccessValue>(defaultValue);

export const AdminAccessProvider = AdminAccessContext.Provider;

/** Use this in any admin page to decide whether to render its write affordances (buttons, forms, toggles) — see fpv-crm-admin-panel skill for the full pattern. */
export function useAdminAccess() {
  return useContext(AdminAccessContext);
}
