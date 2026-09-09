import { Enquiry, EnquiryItem, EnquirySource, MOCK_ENQUIRIES, MOCK_PRODUCTS, MOCK_PARTNERS } from '../data/mockData';

export interface Task {
  id: number;
  enquiryId?: number;
  title: string;
  assignee: string; // 'Roop Raman', 'Sales Team A', 'Yaseen Shaikh', etc.
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  dueDate: string;
  completed: boolean;
  setReminder?: boolean;
}

const ENQUIRIES_KEY = 'sp_crm_enquiries';
const TASKS_KEY = 'sp_crm_tasks';

export const INITIAL_TASKS: Task[] = [
  {
    id: 1,
    enquiryId: 1,
    title: 'Prepare initial quotation for Astral Ltd',
    assignee: 'Shakir Pathan',
    priority: 'High',
    dueDate: new Date().toISOString().split('T')[0], // Today
    completed: false,
    setReminder: true
  },
  {
    id: 2,
    enquiryId: 1,
    title: 'Review chemical safety guidelines',
    assignee: 'Shakir Pathan',
    priority: 'Critical',
    dueDate: new Date().toISOString().split('T')[0], // Today
    completed: false,
    setReminder: true
  },
  {
    id: 3,
    enquiryId: 2,
    title: 'Follow up with Godrej Agrovet on RO Antiscalant',
    assignee: 'Shakir Pathan',
    priority: 'High',
    dueDate: new Date().toISOString().split('T')[0], // Today
    completed: false,
    setReminder: false
  },
  {
    id: 4,
    enquiryId: 2,
    title: 'Update chemical catalog prices',
    assignee: 'Yaseen Shaikh',
    priority: 'Medium',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    completed: false,
    setReminder: false
  },
  {
    id: 5,
    enquiryId: 1,
    title: 'Organize logistics for plant expansion order',
    assignee: 'Shakir Pathan',
    priority: 'Low',
    dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    completed: true, // completed already
    setReminder: false
  }
];

export const INITIAL_ENQUIRIES: Enquiry[] = MOCK_ENQUIRIES;

// Helper to notify all instances of crm store updates
export function notifyStoreUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm-store-update'));
  }
}

function sanitizeEnquiryDates(enquiries: Enquiry[]): Enquiry[] {
  return enquiries.map(e => {
    let requiredByDate = e.requiredByDate;
    if (requiredByDate && requiredByDate.startsWith('2023')) {
      requiredByDate = requiredByDate.replace('2023-11-15', '2026-07-22');
      requiredByDate = requiredByDate.replace('2023-10-', '2026-07-').replace('2023-11-', '2026-07-');
    }
    let date = e.date;
    if (date && date.startsWith('2023')) {
      date = date.replace('2023-10-', '2026-07-').replace('2023-11-', '2026-07-');
    }
    return { ...e, requiredByDate, date };
  });
}

function sanitizeTaskDates(tasks: Task[]): Task[] {
  return tasks.map(t => {
    let dueDate = t.dueDate;
    if (dueDate && dueDate.startsWith('2023')) {
      dueDate = dueDate.replace('2023-10-15', '2026-07-21');
      dueDate = dueDate.replace('2023-10-', '2026-07-').replace('2023-11-', '2026-07-');
    }
    return { ...t, dueDate };
  });
}

export function getEnquiries(): Enquiry[] {
  if (typeof window === 'undefined') return sanitizeEnquiryDates(INITIAL_ENQUIRIES);
  const saved = localStorage.getItem(ENQUIRIES_KEY);
  if (!saved) {
    const sanitized = sanitizeEnquiryDates(INITIAL_ENQUIRIES);
    localStorage.setItem(ENQUIRIES_KEY, JSON.stringify(sanitized));
    return sanitized;
  }
  try {
    const parsed = JSON.parse(saved);
    const sanitized = sanitizeEnquiryDates(parsed);
    if (Array.isArray(sanitized) && sanitized.length < INITIAL_ENQUIRIES.length) {
      // Merge missing initial enquiries so user gets the new mock data without losing custom entries
      const merged = [...sanitized];
      const sanitizedInitials = sanitizeEnquiryDates(INITIAL_ENQUIRIES);
      sanitizedInitials.forEach(init => {
        if (!merged.some(m => m.id === init.id)) {
          merged.push(init);
        }
      });
      localStorage.setItem(ENQUIRIES_KEY, JSON.stringify(merged));
      return merged;
    }
    return sanitized;
  } catch (e) {
    return sanitizeEnquiryDates(INITIAL_ENQUIRIES);
  }
}

export function saveEnquiries(enquiries: Enquiry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENQUIRIES_KEY, JSON.stringify(enquiries));
  notifyStoreUpdate();
}

export function getTasks(): Task[] {
  if (typeof window === 'undefined') return sanitizeTaskDates(INITIAL_TASKS);
  const saved = localStorage.getItem(TASKS_KEY);
  if (!saved) {
    const sanitized = sanitizeTaskDates(INITIAL_TASKS);
    localStorage.setItem(TASKS_KEY, JSON.stringify(sanitized));
    return sanitized;
  }
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return sanitizeTaskDates(INITIAL_TASKS);
    }
    const sanitized = sanitizeTaskDates(parsed);
    const uniqueTasks: Task[] = [];
    const seenIds = new Set<number>();
    sanitized.forEach((t, idx) => {
      let uniqueId = t.id;
      if (!uniqueId || seenIds.has(uniqueId)) {
        uniqueId = Date.now() + idx + Math.floor(Math.random() * 10000);
      }
      seenIds.add(uniqueId);
      uniqueTasks.push({ ...t, id: uniqueId });
    });
    return uniqueTasks;
  } catch (e) {
    return sanitizeTaskDates(INITIAL_TASKS);
  }
}

export function saveTasks(tasks: Task[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  notifyStoreUpdate();
}

// Get dynamic stats for StatHeader
export function getCRMStats() {
  const enquiries = getEnquiries();
  const tasks = getTasks();
  
  // 1. Enquiries assigned to me
  const assignedToMe = enquiries.filter(e => 
    e.assignedTo === 'Shakir Pathan' || 
    e.assignedTo === 'Roop Raman' ||
    e.assignedTo === 'Current User'
  ).length;

  // 2. Active tasks assigned to me
  const myTasks = tasks.filter(t => 
    !t.completed && 
    (t.assignee === 'Shakir Pathan' || t.assignee === 'Roop Raman' || t.assignee === 'Current User')
  ).length;

  // 3. Today's Priorities:
  const priorityEnquiries = enquiries.filter(e => 
    (e.priority === 'High' || e.priority === 'Critical') && 
    (e.assignedTo === 'Shakir Pathan' || e.assignedTo === 'Roop Raman' || e.assignedTo === 'Current User')
  ).length;

  const priorityTasks = tasks.filter(t => 
    !t.completed &&
    (t.priority === 'High' || t.priority === 'Critical') &&
    (t.assignee === 'Shakir Pathan' || t.assignee === 'Roop Raman' || t.assignee === 'Current User')
  ).length;

  const totalPriorities = priorityEnquiries + priorityTasks;

  return {
    assignedToMe,
    myTasks,
    totalPriorities
  };
}

// Global shared activities, calls, and notes
export interface CRMActivity {
  id: number;
  enquiryId: number;
  type: string; // 'Log Call' | 'Add Note' | 'Log Visit' | 'Log Email' | 'Log Meeting'
  title: string;
  timestamp: string;
  description: string;
  attachment: string | null;
  followUpDate: string | null;
}

const ACTIVITIES_KEY = 'sp_crm_activities';

// Standardized initial activities relative to current date (July 2026)
export const INITIAL_ACTIVITIES: CRMActivity[] = [
  {
    id: 1,
    enquiryId: 1,
    type: 'Log Call',
    title: 'Outbound Call',
    timestamp: 'Yesterday, 10:30 AM',
    description: 'Spoke with Astral representative about filter cartridge quantity and lead times. Needs urgent quotation.',
    attachment: null,
    followUpDate: new Date(Date.now() + 86400000 * 2).toISOString().substring(0, 16) // 2 days from now (July 23, 2026)
  },
  {
    id: 2,
    enquiryId: 2,
    type: 'Add Note',
    title: 'Note Added',
    timestamp: 'Today, 9:15 AM',
    description: 'Discussing budget approval for RO Antiscalant. They are happy with standard delivery.',
    attachment: null,
    followUpDate: new Date(Date.now() + 86400000 * 4).toISOString().substring(0, 16) // 4 days from now (July 25, 2026)
  },
  {
    id: 3,
    enquiryId: 3,
    type: 'Log Visit',
    title: 'Site Visit',
    timestamp: '2 days ago',
    description: 'Inspected the water treatment facility. Met with engineering head to verify membrane specs.',
    attachment: 'site_specs_v1.pdf',
    followUpDate: new Date(Date.now() + 86400000 * 7).toISOString().substring(0, 16) // 7 days from now (July 28, 2026)
  },
  {
    id: 4,
    enquiryId: 4,
    type: 'Log Meeting',
    title: 'Meeting Logged',
    timestamp: 'Today, 8:00 AM',
    description: 'Aligned with technical purchasing department. Pricing proposal approved conditionally.',
    attachment: null,
    followUpDate: new Date(Date.now() + 86400000 * 12).toISOString().substring(0, 16) // 12 days from now
  }
];

export function getActivities(): CRMActivity[] {
  if (typeof window === 'undefined') return INITIAL_ACTIVITIES;
  const saved = localStorage.getItem(ACTIVITIES_KEY);
  if (!saved) {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(INITIAL_ACTIVITIES));
    return INITIAL_ACTIVITIES;
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length === 0) {
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(INITIAL_ACTIVITIES));
      return INITIAL_ACTIVITIES;
    }
    if (!Array.isArray(parsed)) {
      return INITIAL_ACTIVITIES;
    }
    const uniqueActivities: CRMActivity[] = [];
    const seenIds = new Set<number>();
    parsed.forEach((a, idx) => {
      let uniqueId = a.id;
      if (!uniqueId || seenIds.has(uniqueId)) {
        uniqueId = Date.now() + idx + Math.floor(Math.random() * 10000);
      }
      seenIds.add(uniqueId);
      uniqueActivities.push({ ...a, id: uniqueId });
    });
    return uniqueActivities;
  } catch (e) {
    return INITIAL_ACTIVITIES;
  }
}

export function saveActivities(activities: CRMActivity[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
  notifyStoreUpdate();
}


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
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return MOCK_LEADS;
    return parsed.map((lead: Lead) => {
      const defaultMock = MOCK_LEADS.find(m => m.id === lead.id);
      return {
        ...defaultMock,
        ...lead,
        potentialBusinessValue: lead.potentialBusinessValue ?? defaultMock?.potentialBusinessValue ?? 150000,
        followUps: lead.followUps || defaultMock?.followUps || [],
        activities: lead.activities || defaultMock?.activities || []
      };
    });
  } catch (e) {
    return MOCK_LEADS;
  }
}

export function saveLeads(leads: Lead[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  notifyStoreUpdate();
}

export function convertLeadToEnquiry(leadId: number): { lead: Lead; enquiry: Enquiry } | null {
  const leads = getLeads();
  const leadIndex = leads.findIndex(l => l.id === leadId);
  if (leadIndex === -1) return null;

  const targetLead = leads[leadIndex];
  const updatedLead: Lead = {
    ...targetLead,
    status: 'Converted',
    activities: [
      {
        id: Date.now(),
        date: new Date().toISOString(),
        type: 'System',
        description: 'Converted lead directly to formal Enquiry.',
        performedBy: 'Current User'
      },
      ...(targetLead.activities || [])
    ]
  };
  leads[leadIndex] = updatedLead;
  saveLeads(leads);

  const enquiries = getEnquiries();
  const nextId = enquiries.length > 0 ? Math.max(...enquiries.map(e => e.id)) + 1 : 1;
  const enquiryNumStr = String(nextId).padStart(3, '0');
  
  const mappedItems: EnquiryItem[] = (targetLead.interestedProducts || []).map((p, idx) => {
    const productObj = MOCK_PRODUCTS.find(mp => mp.id === p.productId);
    return {
      id: idx + 1,
      productId: p.productId,
      product: productObj ? productObj.name : 'Inquired Product Item',
      quantity: p.quantity || 1,
      unit: productObj ? productObj.unit : 'Nos',
      targetPrice: productObj ? productObj.standardSellingPrice : undefined,
      remarks: p.remarks || 'Converted from Lead'
    };
  });

  const validSources: EnquirySource[] = ['Call', 'Email', 'WhatsApp', 'Website', 'Reference', 'Visit', 'Existing Customer'];
  const enquirySource: EnquirySource = validSources.includes(targetLead.leadSource as any)
    ? (targetLead.leadSource as EnquirySource)
    : 'Email';

  const newEnquiry: Enquiry = {
    id: nextId,
    enquiryNumber: `ENQ-2026-${enquiryNumStr}`,
    title: `Enquiry for ${targetLead.companyName}`,
    companyId: targetLead.companyId || 1,
    contactId: 1,
    priority: 'High',
    source: enquirySource,
    assignedTo: targetLead.assignedTo || 'Shakir Pathan',
    description: targetLead.leadDescription || `Requirement from lead ${targetLead.leadNumber} - Contact: ${targetLead.contactPerson}`,
    status: 'Open',
    stage: 'New',
    date: new Date().toISOString().split('T')[0],
    requiredByDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
    items: mappedItems.length > 0 ? mappedItems : [
      { id: 1, product: 'Requirement as per Lead Details', quantity: 1, unit: 'Nos', remarks: targetLead.leadDescription }
    ],
    createdBy: targetLead.assignedTo || 'Shakir Pathan',
    lastUpdated: new Date().toISOString()
  };

  saveEnquiries([newEnquiry, ...enquiries]);
  return { lead: updatedLead, enquiry: newEnquiry };
}

export function getPartners() {
  return MOCK_PARTNERS;
}

export function getQuotations() {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('sp_crm_quotations');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      // Fallback
    }
  }
  return [];
}

