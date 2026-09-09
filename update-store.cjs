const fs = require('fs');
let file = fs.readFileSync('src/utils/crmStore.ts', 'utf8');

if (!file.includes('getLeads()')) {
  file += `
import { MOCK_LEADS, Lead } from '../data/mockLeads';

const LEADS_KEY = 'sp_crm_leads';

export function getLeads(): Lead[] {
  if (typeof window === 'undefined') return MOCK_LEADS;
  const saved = localStorage.getItem(LEADS_KEY);
  if (!saved) {
    localStorage.setItem(LEADS_KEY, JSON.stringify(MOCK_LEADS));
    return MOCK_LEADS;
  }
  try {
    return JSON.parse(saved);
  } catch (e) {
    return MOCK_LEADS;
  }
}

export function saveLeads(leads: Lead[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  notifyStoreUpdate();
}
`;
  fs.writeFileSync('src/utils/crmStore.ts', file);
  console.log('Added Leads to store');
} else {
  console.log('Already in store');
}
