export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Unqualified' | 'Lost' | 'Converted';
export type LeadSource = 'Website' | 'Trade Fair / Exhibition' | 'Cold Call' | 'Reference' | 'Walk-in' | 'LinkedIn' | 'Email Campaign' | 'WhatsApp' | 'Google Search' | 'Existing Customer' | 'Distributor' | 'Other';

export interface LeadFollowUp {
  id: number;
  date: string;
  type: 'Phone Call' | 'Email' | 'Meeting' | 'Site Visit' | 'WhatsApp Conversation';
  remarks: string;
  status: 'Pending' | 'Completed' | 'Missed';
}

export interface LeadActivity {
  id: number;
  date: string;
  type: 'Add Note' | 'Phone Call' | 'Email' | 'Meeting' | 'Site Visit' | 'WhatsApp Conversation' | 'Upload Document' | 'System';
  description: string;
  performedBy: string;
}

export interface Lead {
  id: number;
  leadNumber: string;
  companyName: string;
  companyId?: number; // Link to existing company if any
  contactPerson: string;
  designation: string;
  mobileNumber: string;
  emailAddress: string;
  website?: string;
  city: string;
  state: string;
  country: string;
  industry: string;
  leadSource: LeadSource;
  interestedProducts: { productId: number; quantity?: number; remarks?: string }[];
  leadDescription: string;
  assignedTo: string;
  createdDate: string;
  status: LeadStatus;
  
  // Qualification
  budgetAvailable?: 'Yes' | 'No';
  decisionMakerIdentified?: 'Yes' | 'No';
  requirementIdentified?: 'Yes' | 'No';
  expectedPurchaseTimeline?: string;
  potentialBusinessValue?: number;
  competitorName?: string;
  leadScore?: number;

  followUps: LeadFollowUp[];
  activities: LeadActivity[];
}

export const MOCK_LEADS: Lead[] = [
  {
    id: 1,
    leadNumber: 'LD-2026-001',
    companyName: 'Astral Limited',
    companyId: 1,
    contactPerson: 'Rahul Sharma',
    designation: 'Purchase Manager',
    mobileNumber: '+91 9876543210',
    emailAddress: 'rahul@astrallimited.com',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    industry: 'Manufacturing',
    leadSource: 'Trade Fair / Exhibition',
    interestedProducts: [{ productId: 1, quantity: 500 }, { productId: 3, quantity: 150 }],
    leadDescription: 'Requires high volume PP Melt Blown cartridges & Boiler treatment chemicals for upcoming plant expansion.',
    assignedTo: 'Amol Patil',
    createdDate: '2026-07-15T10:00:00Z',
    status: 'Qualified',
    budgetAvailable: 'Yes',
    decisionMakerIdentified: 'Yes',
    requirementIdentified: 'Yes',
    expectedPurchaseTimeline: 'Within 30 Days',
    potentialBusinessValue: 125000,
    leadScore: 85,
    followUps: [
      { id: 101, date: '2026-07-26T10:30:00Z', type: 'Site Visit', remarks: 'Site visit for technical measurement at Ahmedabad plant.', status: 'Pending' }
    ],
    activities: [
      { id: 201, date: '2026-07-15T10:00:00Z', type: 'System', description: 'Lead created from Trade Fair inquiry.', performedBy: 'Shakir Pathan' },
      { id: 202, date: '2026-07-18T14:00:00Z', type: 'Phone Call', description: 'Technical specs discussion with Rahul Sharma.', performedBy: 'Amol Patil' }
    ]
  },
  {
    id: 2,
    leadNumber: 'LD-2026-002',
    companyName: 'Godrej Agrovet Limited',
    companyId: 4,
    contactPerson: 'Mahesh Deshmukh',
    designation: 'Plant Engineer',
    mobileNumber: '+91 9822334455',
    emailAddress: 'mahesh.d@godrejagrovet.com',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    industry: 'Agriculture',
    leadSource: 'Website',
    interestedProducts: [{ productId: 5, quantity: 1000 }],
    leadDescription: 'Needs sample testing & bulk supply quotation for RO Antiscalant chemical.',
    assignedTo: 'Yaseen Shaikh',
    createdDate: '2026-07-18T11:00:00Z',
    status: 'Contacted',
    budgetAvailable: 'Yes',
    decisionMakerIdentified: 'Yes',
    requirementIdentified: 'Yes',
    expectedPurchaseTimeline: 'Within 15 Days',
    potentialBusinessValue: 350000,
    leadScore: 90,
    followUps: [
      { id: 102, date: '2026-07-26T15:00:00Z', type: 'Phone Call', remarks: 'Follow up on sample chemical lab report.', status: 'Pending' }
    ],
    activities: [
      { id: 203, date: '2026-07-18T11:00:00Z', type: 'System', description: 'Inquiry received via website form.', performedBy: 'System' },
      { id: 204, date: '2026-07-20T10:00:00Z', type: 'Email', description: 'Sent RO Antiscalant technical datasheet and sample report.', performedBy: 'Yaseen Shaikh' }
    ]
  },
  {
    id: 3,
    leadNumber: 'LD-2026-003',
    companyName: 'Bal Pharma Ltd.',
    companyId: 2,
    contactPerson: 'Vikas Kumar',
    designation: 'Procurement Manager',
    mobileNumber: '+91 80 1234 5678',
    emailAddress: 'vikas@balpharma.com',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    industry: 'Pharmaceuticals',
    leadSource: 'Existing Customer',
    interestedProducts: [{ productId: 3, quantity: 200 }],
    leadDescription: 'Evaluating new supplier for Boiler Treatment Chemicals for plant utility.',
    assignedTo: 'Jeevan Kolap',
    createdDate: '2026-07-10T09:30:00Z',
    status: 'Converted',
    budgetAvailable: 'Yes',
    decisionMakerIdentified: 'Yes',
    requirementIdentified: 'Yes',
    potentialBusinessValue: 95000,
    leadScore: 95,
    followUps: [],
    activities: [
      { id: 205, date: '2026-07-10T09:30:00Z', type: 'System', description: 'Lead Created', performedBy: 'Shakir Pathan' },
      { id: 206, date: '2026-07-14T11:00:00Z', type: 'System', description: 'Converted to Enquiry ENQ-2023-001', performedBy: 'Jeevan Kolap' }
    ]
  },
  {
    id: 4,
    leadNumber: 'LD-2026-004',
    companyName: 'Biltube Industries Ltd.',
    companyId: 12,
    contactPerson: 'Sanjay Kulkarni',
    designation: 'Factory Head',
    mobileNumber: '+91 20 4455 6677',
    emailAddress: 'sanjay.k@biltube.com',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    industry: 'Manufacturing',
    leadSource: 'Cold Call',
    interestedProducts: [{ productId: 2, quantity: 300 }],
    leadDescription: 'Inquired about 5 micron PP Melt Blown cartridges for industrial effluent treatment plant.',
    assignedTo: 'Sammer Pathan',
    createdDate: '2026-07-21T14:15:00Z',
    status: 'New',
    budgetAvailable: 'No',
    decisionMakerIdentified: 'Yes',
    requirementIdentified: 'Yes',
    expectedPurchaseTimeline: 'Next Quarter',
    potentialBusinessValue: 45000,
    leadScore: 60,
    followUps: [
      { id: 103, date: '2026-07-27T11:00:00Z', type: 'Meeting', remarks: 'First introductory meeting with Sanjay Kulkarni in Pune.', status: 'Pending' }
    ],
    activities: [
      { id: 207, date: '2026-07-21T14:15:00Z', type: 'Phone Call', description: 'Cold call connected. Requested product brochure.', performedBy: 'Sammer Pathan' }
    ]
  },
  {
    id: 5,
    leadNumber: 'LD-2026-005',
    companyName: 'Jsons Foundry Pvt. Ltd.',
    companyId: 6,
    contactPerson: 'Anil Patil',
    designation: 'Utilities Engineer',
    mobileNumber: '+91 233 1234 5678',
    emailAddress: 'anil@jsonsfoundry.com',
    city: 'Sangli',
    state: 'Maharashtra',
    country: 'India',
    industry: 'Manufacturing',
    leadSource: 'Reference',
    interestedProducts: [{ productId: 4, quantity: 500 }],
    leadDescription: 'Urgent Cooling Tower Biocide requirement to control algae growth.',
    assignedTo: 'Shakir Pathan',
    createdDate: '2026-07-12T08:00:00Z',
    status: 'Qualified',
    budgetAvailable: 'Yes',
    decisionMakerIdentified: 'Yes',
    requirementIdentified: 'Yes',
    expectedPurchaseTimeline: 'Immediate',
    potentialBusinessValue: 180000,
    leadScore: 88,
    followUps: [
      { id: 104, date: '2026-07-28T14:00:00Z', type: 'Email', remarks: 'Send final commercial terms and delivery schedule.', status: 'Pending' }
    ],
    activities: [
      { id: 208, date: '2026-07-12T08:00:00Z', type: 'System', description: 'Lead referred by regional distributor.', performedBy: 'Shakir Pathan' }
    ]
  },
  {
    id: 6,
    leadNumber: 'LD-2026-006',
    companyName: 'Roquette India Pvt. Ltd.',
    companyId: 9,
    contactPerson: 'Priya Nambiar',
    designation: 'Quality Control Lead',
    mobileNumber: '+91 22 1122 3344',
    emailAddress: 'priya.nambiar@roquette.com',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    industry: 'Food & Beverage',
    leadSource: 'LinkedIn',
    interestedProducts: [{ productId: 1, quantity: 1000 }],
    leadDescription: 'Sanitary grade filter cartridges for starch processing unit.',
    assignedTo: 'Amol Patil',
    createdDate: '2026-07-19T16:30:00Z',
    status: 'New',
    budgetAvailable: 'Yes',
    decisionMakerIdentified: 'No',
    requirementIdentified: 'Yes',
    expectedPurchaseTimeline: 'Within 60 Days',
    potentialBusinessValue: 220000,
    leadScore: 70,
    followUps: [
      { id: 105, date: '2026-07-27T10:00:00Z', type: 'Phone Call', remarks: 'Call to identify primary purchase authority.', status: 'Pending' }
    ],
    activities: [
      { id: 209, date: '2026-07-19T16:30:00Z', type: 'System', description: 'Inbound message from LinkedIn campaign.', performedBy: 'Amol Patil' }
    ]
  }
];
