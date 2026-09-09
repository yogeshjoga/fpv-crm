export interface Contact {
  id: number;
  name: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface BusinessPartner {
  id: number;
  name: string;
  type: string;
  industry: string;
  city: string;
  phone: string;
  status: 'Active' | 'Inactive' | 'Draft';
  website?: string;
  email?: string;
  address?: string;
  gst?: string;
  category?: string;
  creditLimit?: string;
  paymentTerms?: string;
  contacts?: Contact[];
}

export interface EnquiryItem {
  id: number;
  productId?: number;
  product: string;
  quantity: number;
  unit: string;
  targetPrice?: number;
  remarks?: string;
}

export type EnquiryPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type EnquirySource = 'Call' | 'Email' | 'WhatsApp' | 'Website' | 'Reference' | 'Visit' | 'Existing Customer';
export type EnquiryStatus = 'Open' | 'Under Review' | 'Waiting Customer' | 'Waiting Internal' | 'On Hold' | 'Closed';
export type EnquiryStage = 'New' | 'In Progress' | 'Quotation' | 'Followup' | 'Negotiation' | 'Won' | 'Lost' | 'Sales Order';

export interface Enquiry {
  id: number;
  enquiryNumber: string;
  title: string;
  date: string;
  requiredByDate?: string;
  companyId: number;
  contactId?: number;
  priority: EnquiryPriority;
  source: EnquirySource;
  assignedTo: string;
  description?: string;
  status: EnquiryStatus;
  stage: EnquiryStage;
  items: EnquiryItem[];
  createdBy: string;
  lastUpdated: string;
  notes?: string;
}

export const MOCK_ENQUIRIES: Enquiry[] = [
  {
    id: 1,
    enquiryNumber: 'ENQ-2023-001',
    title: 'Cartridges and Chemicals for Plant Expansion',
    date: '2026-07-20',
    requiredByDate: '2026-07-22',
    companyId: 1, // Astral Limited
    contactId: 1, // Rahul Sharma
    priority: 'High',
    source: 'Email',
    assignedTo: 'Shakir Pathan',
    description: 'Urgent requirement for upcoming plant expansion.',
    status: 'Open',
    stage: 'In Progress',
    items: [
      { id: 1, productId: 1, product: 'PP Melt Blown Cartridge 1 Micron', quantity: 500, unit: 'Nos' },
      { id: 2, productId: 3, product: 'Boiler Treatment Chemical', quantity: 200, unit: 'Kg' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-10-25T10:00:00Z',
    notes: 'Needs technical review before quote.'
  },
  {
    id: 2,
    enquiryNumber: 'ENQ-2023-002',
    title: 'RO Chemicals Bulk Order',
    date: '2023-10-26',
    companyId: 4, // Godrej Agrovet
    priority: 'Medium',
    source: 'Call',
    assignedTo: 'Yaseen Shaikh',
    status: 'Waiting Customer',
    stage: 'Followup',
    items: [
      { id: 1, productId: 5, product: 'RO Antiscalant', quantity: 1000, unit: 'Ltr' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-10-28T14:30:00Z'
  },
  {
    id: 3,
    enquiryNumber: 'ENQ-2023-003',
    title: 'Water Treatment Plant Spares',
    date: '2023-10-27',
    companyId: 12, // Biltube Industries
    priority: 'High',
    source: 'WhatsApp',
    assignedTo: 'Amol Patil',
    status: 'Open',
    stage: 'New',
    items: [
      { id: 1, productId: 2, product: 'PP Melt Blown Cartridge 5 Micron', quantity: 150, unit: 'Nos' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-10-27T12:00:00Z'
  },
  {
    id: 4,
    enquiryNumber: 'ENQ-2023-004',
    title: 'Cooling Tower Biocide Annual Contract',
    date: '2023-10-28',
    companyId: 6, // Jsons Foundry
    priority: 'Critical',
    source: 'Email',
    assignedTo: 'Amol Patil',
    status: 'Open',
    stage: 'Quotation',
    items: [
      { id: 1, productId: 4, product: 'Cooling Tower Biocide', quantity: 800, unit: 'Kg' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-10-28T11:00:00Z'
  },
  {
    id: 5,
    enquiryNumber: 'ENQ-2023-005',
    title: 'Boiler Chemicals & Spares',
    date: '2023-10-29',
    companyId: 7, // Jollyboard Ltd.
    priority: 'Low',
    source: 'Website',
    assignedTo: 'Jeevan Kolap',
    status: 'Open',
    stage: 'Negotiation',
    items: [
      { id: 1, productId: 2, product: 'PP Melt Blown Cartridge 5 Micron', quantity: 100, unit: 'Nos' },
      { id: 2, productId: 3, product: 'Boiler Treatment Chemical', quantity: 150, unit: 'Kg' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-10-29T15:45:00Z'
  },
  {
    id: 6,
    enquiryNumber: 'ENQ-2023-006',
    title: 'High Volume Cartridges Procurement',
    date: '2023-10-30',
    companyId: 10, // Shree Basaveshwar Sugars
    priority: 'Medium',
    source: 'Reference',
    assignedTo: 'Sammer Pathan',
    status: 'Closed',
    stage: 'Won',
    items: [
      { id: 1, productId: 1, product: 'PP Melt Blown Cartridge 1 Micron', quantity: 1200, unit: 'Nos' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-10-30T16:20:00Z'
  },
  {
    id: 7,
    enquiryNumber: 'ENQ-2023-007',
    title: 'RO Membrane Antiscalant Trial',
    date: '2023-11-01',
    companyId: 1, // Astral Limited
    contactId: 1, // Rahul Sharma
    priority: 'High',
    source: 'Email',
    assignedTo: 'Shakir Pathan',
    status: 'Open',
    stage: 'New',
    items: [
      { id: 1, productId: 5, product: 'RO Antiscalant', quantity: 250, unit: 'Ltr' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-11-01T09:15:00Z'
  },
  {
    id: 8,
    enquiryNumber: 'ENQ-2023-008',
    title: 'Quarterly Biocide Restocking',
    date: '2023-11-02',
    companyId: 9, // Roquette India
    priority: 'Medium',
    source: 'Call',
    assignedTo: 'Yaseen Shaikh',
    status: 'Open',
    stage: 'In Progress',
    items: [
      { id: 1, productId: 4, product: 'Cooling Tower Biocide', quantity: 350, unit: 'Kg' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-11-02T14:10:00Z'
  },
  {
    id: 9,
    enquiryNumber: 'ENQ-2023-009',
    title: 'Filter Cartridges Urgent Order',
    date: '2023-11-03',
    companyId: 4, // Godrej Agrovet
    priority: 'Critical',
    source: 'WhatsApp',
    assignedTo: 'Amol Patil',
    status: 'Open',
    stage: 'Quotation',
    items: [
      { id: 1, productId: 2, product: 'PP Melt Blown Cartridge 5 Micron', quantity: 400, unit: 'Nos' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-11-03T11:30:00Z'
  },
  {
    id: 10,
    enquiryNumber: 'ENQ-2023-010',
    title: 'Annual Boiler Water Treatment Supply',
    date: '2023-11-04',
    companyId: 12, // Biltube Industries
    priority: 'High',
    source: 'Visit',
    assignedTo: 'Jeevan Kolap',
    status: 'Closed',
    stage: 'Won',
    items: [
      { id: 1, productId: 3, product: 'Boiler Treatment Chemical', quantity: 2400, unit: 'Kg' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-11-04T10:00:00Z'
  },
  {
    id: 11,
    enquiryNumber: 'ENQ-2023-011',
    title: 'Emergency Membrane Antiscalant supply',
    date: '2023-11-05',
    companyId: 6, // Jsons Foundry
    priority: 'Critical',
    source: 'Email',
    assignedTo: 'Shakir Pathan',
    status: 'Open',
    stage: 'Sales Order',
    items: [
      { id: 1, productId: 5, product: 'RO Antiscalant', quantity: 600, unit: 'Ltr' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-11-05T08:45:00Z'
  },
  {
    id: 12,
    enquiryNumber: 'ENQ-2023-012',
    title: 'Initial plant testing filtration system',
    date: '2023-11-06',
    companyId: 10, // Shree Basaveshwar Sugars
    priority: 'Low',
    source: 'Call',
    assignedTo: 'Sammer Pathan',
    status: 'Closed',
    stage: 'Lost',
    items: [
      { id: 1, productId: 1, product: 'PP Melt Blown Cartridge 1 Micron', quantity: 80, unit: 'Nos' }
    ],
    createdBy: 'Admin',
    lastUpdated: '2023-11-06T15:00:00Z'
  }
];

export interface ProductVendorCost {
  id: number;
  costHead: string;
  amount: number;
  type: 'Fixed' | 'Percentage';
  remarks?: string;
}

export interface ProductVendor {
  id: number;
  vendorId: number; // reference to BusinessPartner
  vendorProductCode: string;
  purchasePrice: number;
  currency: string;
  unit: string;
  moq: number;
  leadTime: string;
  paymentTerms: string;
  priceValidTill: string;
  isPreferred: boolean;
  status: 'Active' | 'Inactive';
  lastUpdated: string;
  remarks?: string;
  additionalCosts: ProductVendorCost[];
}

export interface ProductPriceHistory {
  id: number;
  vendorId: number;
  oldPrice: number;
  newPrice: number;
  updatedBy: string;
  updatedDate: string;
  reason: string;
  remarks?: string;
}

export interface Product {
  id: number;
  name: string;
  code: string;
  category: string;
  brand: string;
  unit: string;
  hsnCode: string;
  gst: number;
  description: string;
  status: 'Active' | 'Inactive' | 'Discontinued' | 'Seasonal' | 'Special Order';
  standardSellingPrice?: number;
  minimumSellingPrice?: number;
  vendors: ProductVendor[];
  priceHistory: ProductPriceHistory[];
  lastUpdated: string;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'PP Melt Blown Cartridge 1 Micron',
    code: 'CAR-001',
    category: 'Filter Cartridges',
    brand: 'FilterPro',
    unit: 'Nos',
    hsnCode: '842199',
    gst: 18,
    description: 'High dirt holding capacity 1 micron spun filter cartridge.',
    status: 'Active',
    standardSellingPrice: 150,
    minimumSellingPrice: 135,
    vendors: [
      {
        id: 1,
        vendorId: 2, // Bal Pharma Ltd
        vendorProductCode: 'BP-MB-001',
        purchasePrice: 110,
        currency: 'INR',
        unit: 'Nos',
        moq: 100,
        leadTime: '5 Days',
        paymentTerms: 'Net 30',
        priceValidTill: '2024-12-31',
        isPreferred: true,
        status: 'Active',
        lastUpdated: '2023-10-01T10:00:00Z',
        additionalCosts: [
          { id: 1, costHead: 'Freight Charges', amount: 5, type: 'Fixed' }
        ]
      },
      {
        id: 2,
        vendorId: 5, // Healthline Pharmaceuticals
        vendorProductCode: 'HL-MB-1M',
        purchasePrice: 115,
        currency: 'INR',
        unit: 'Nos',
        moq: 50,
        leadTime: '3 Days',
        paymentTerms: 'Advance',
        priceValidTill: '2023-12-31',
        isPreferred: false,
        status: 'Active',
        lastUpdated: '2023-09-15T10:00:00Z',
        additionalCosts: []
      }
    ],
    priceHistory: [],
    lastUpdated: '2023-10-01T10:00:00Z'
  },
  {
    id: 2,
    name: 'PP Melt Blown Cartridge 5 Micron',
    code: 'CAR-002',
    category: 'Filter Cartridges',
    brand: 'FilterPro',
    unit: 'Nos',
    hsnCode: '842199',
    gst: 18,
    description: 'Standard 5 micron spun filter cartridge for general filtration.',
    status: 'Active',
    standardSellingPrice: 145,
    minimumSellingPrice: 130,
    vendors: [
      {
        id: 3,
        vendorId: 2, // Bal Pharma Ltd
        vendorProductCode: 'BP-MB-005',
        purchasePrice: 105,
        currency: 'INR',
        unit: 'Nos',
        moq: 100,
        leadTime: '5 Days',
        paymentTerms: 'Net 30',
        priceValidTill: '2024-12-31',
        isPreferred: true,
        status: 'Active',
        lastUpdated: '2023-10-01T10:00:00Z',
        additionalCosts: []
      }
    ],
    priceHistory: [],
    lastUpdated: '2023-10-01T10:00:00Z'
  },
  {
    id: 3,
    name: 'Boiler Treatment Chemical',
    code: 'BCH-001',
    category: 'Boiler Chemicals',
    brand: 'ChemPro',
    unit: 'Kg',
    hsnCode: '382490',
    gst: 18,
    description: 'Multipurpose boiler water treatment chemical for scale and corrosion control.',
    status: 'Active',
    standardSellingPrice: 250,
    minimumSellingPrice: 220,
    vendors: [
      {
        id: 4,
        vendorId: 11, // Epsilon Carbon Pvt. Ltd.
        vendorProductCode: 'EPS-BTC-1',
        purchasePrice: 185,
        currency: 'INR',
        unit: 'Kg',
        moq: 50,
        leadTime: '7 Days',
        paymentTerms: 'Net 15',
        priceValidTill: '2023-12-31',
        isPreferred: true,
        status: 'Active',
        lastUpdated: '2023-09-20T10:00:00Z',
        additionalCosts: [
          { id: 2, costHead: 'Transportation Cost', amount: 10, type: 'Fixed' },
          { id: 3, costHead: 'Handling Charges', amount: 5, type: 'Fixed' }
        ]
      }
    ],
    priceHistory: [
      { id: 1, vendorId: 11, oldPrice: 180, newPrice: 185, updatedBy: 'Admin', updatedDate: '2023-09-20T10:00:00Z', reason: 'Supplier revised pricing' }
    ],
    lastUpdated: '2023-09-20T10:00:00Z'
  },
  {
    id: 4,
    name: 'Cooling Tower Biocide',
    code: 'CTC-002',
    category: 'Cooling Tower Chemicals',
    brand: 'ChemPro',
    unit: 'Kg',
    hsnCode: '380894',
    gst: 18,
    description: 'Broad spectrum non-oxidizing biocide for cooling towers.',
    status: 'Active',
    standardSellingPrice: 400,
    minimumSellingPrice: 380,
    vendors: [
      {
        id: 5,
        vendorId: 11,
        vendorProductCode: 'EPS-CTB-2',
        purchasePrice: 320,
        currency: 'INR',
        unit: 'Kg',
        moq: 30,
        leadTime: '10 Days',
        paymentTerms: 'Net 15',
        priceValidTill: '2024-06-30',
        isPreferred: true,
        status: 'Active',
        lastUpdated: '2023-10-05T10:00:00Z',
        additionalCosts: []
      }
    ],
    priceHistory: [],
    lastUpdated: '2023-10-05T10:00:00Z'
  },
  {
    id: 5,
    name: 'RO Antiscalant',
    code: 'ROC-001',
    category: 'RO Chemicals',
    brand: 'AquaClear',
    unit: 'Ltr',
    hsnCode: '382490',
    gst: 18,
    description: 'High performance RO membrane antiscalant.',
    status: 'Active',
    standardSellingPrice: 350,
    minimumSellingPrice: 300,
    vendors: [
      {
        id: 6,
        vendorId: 8, // Mark International
        vendorProductCode: 'MI-RO-AS',
        purchasePrice: 240,
        currency: 'INR',
        unit: 'Ltr',
        moq: 100,
        leadTime: '5 Days',
        paymentTerms: 'Net 30',
        priceValidTill: '2023-12-31',
        isPreferred: true,
        status: 'Active',
        lastUpdated: '2023-08-10T10:00:00Z',
        additionalCosts: [
          { id: 4, costHead: 'Freight Charges', amount: 8, type: 'Fixed' }
        ]
      },
      {
        id: 7,
        vendorId: 9, // Roquette India
        vendorProductCode: 'RQ-RO-A1',
        purchasePrice: 255,
        currency: 'INR',
        unit: 'Ltr',
        moq: 50,
        leadTime: '7 Days',
        paymentTerms: 'Net 45',
        priceValidTill: '2024-03-31',
        isPreferred: false,
        status: 'Active',
        lastUpdated: '2023-09-01T10:00:00Z',
        additionalCosts: []
      }
    ],
    priceHistory: [],
    lastUpdated: '2023-09-01T10:00:00Z'
  }
];

export const MOCK_PARTNERS: BusinessPartner[] = [
  {
    id: 1,
    name: 'Astral Limited',
    type: 'Customer',
    industry: 'Manufacturing',
    city: 'Ahmedabad',
    phone: '+91 79 1234 5678',
    status: 'Active',
    email: 'contact@astrallimited.com',
    address: 'Astral House, Ahmedabad, Gujarat',
    contacts: [
      { id: 1, name: 'Rahul Sharma', designation: 'Purchase Manager', department: 'Procurement', email: 'rahul@astrallimited.com', phone: '+91 9876543210', isPrimary: true }
    ]
  },
  {
    id: 2,
    name: 'Bal Pharma Ltd.',
    type: 'Supplier',
    industry: 'Pharmaceuticals',
    city: 'Bangalore',
    phone: '+91 80 1234 5678',
    status: 'Active'
  },
  {
    id: 3,
    name: 'Bhumi Green Energy Pvt. Ltd.',
    type: 'Both',
    industry: 'Energy',
    city: 'Pune',
    phone: '+91 20 1234 5678',
    status: 'Active'
  },
  {
    id: 4,
    name: 'Godrej Agrovet Limited',
    type: 'Customer',
    industry: 'Agriculture',
    city: 'Mumbai',
    phone: '+91 22 1234 5678',
    status: 'Active'
  },
  {
    id: 5,
    name: 'Healthline Pharmaceuticals Pvt. Ltd.',
    type: 'Supplier',
    industry: 'Pharmaceuticals',
    city: 'Hyderabad',
    phone: '+91 40 1234 5678',
    status: 'Active'
  },
  {
    id: 6,
    name: 'Jsons Foundry Pvt. Ltd.',
    type: 'Customer',
    industry: 'Manufacturing',
    city: 'Sangli',
    phone: '+91 233 1234 5678',
    status: 'Active'
  },
  {
    id: 7,
    name: 'Jollyboard Ltd.',
    type: 'Customer',
    industry: 'Manufacturing',
    city: 'Mumbai',
    phone: '+91 22 8765 4321',
    status: 'Active'
  },
  {
    id: 8,
    name: 'Mark International Foods Stuff Pvt. Ltd.',
    type: 'Supplier',
    industry: 'Food & Beverage',
    city: 'Delhi',
    phone: '+91 11 1234 5678',
    status: 'Active'
  },
  {
    id: 9,
    name: 'Roquette India Pvt. Ltd.',
    type: 'Both',
    industry: 'Food & Beverage',
    city: 'Mumbai',
    phone: '+91 22 1122 3344',
    status: 'Active'
  },
  {
    id: 10,
    name: 'Shree Basaveshwar Sugars Ltd.',
    type: 'Customer',
    industry: 'Agriculture',
    city: 'Bijapur',
    phone: '+91 8352 123456',
    status: 'Active'
  },
  {
    id: 11,
    name: 'Epsilon Carbon Pvt. Ltd.',
    type: 'Supplier',
    industry: 'Chemicals',
    city: 'Mumbai',
    phone: '+91 22 9988 7766',
    status: 'Active'
  },
  {
    id: 12,
    name: 'Biltube Industries Ltd.',
    type: 'Customer',
    industry: 'Manufacturing',
    city: 'Pune',
    phone: '+91 20 4455 6677',
    status: 'Active'
  },
  {
    id: 13,
    name: 'Medispray Laboratories Pvt. Ltd.',
    type: 'Both',
    industry: 'Pharmaceuticals',
    city: 'Satara',
    phone: '+91 2162 123456',
    status: 'Inactive'
  }
];

export interface AppUser {
  id: number;
  name: string;
  role: 'Admin' | 'User';
  email: string;
  avatar?: string;
  status: 'Active' | 'Inactive';
}

export const MOCK_USERS: AppUser[] = [
  { id: 1, name: 'Shakir Pathan', role: 'Admin', email: 'shakir@spcrm.com', status: 'Active' },
  { id: 2, name: 'Yaseen Shaikh', role: 'User', email: 'yaseen@spcrm.com', status: 'Active' },
  { id: 3, name: 'Jeevan Kolap', role: 'User', email: 'jeevan@spcrm.com', status: 'Active' },
  { id: 4, name: 'Amol Patil', role: 'User', email: 'amol@spcrm.com', status: 'Active' },
  { id: 5, name: 'Sammer Pathan', role: 'User', email: 'sammer@spcrm.com', status: 'Active' },
];
