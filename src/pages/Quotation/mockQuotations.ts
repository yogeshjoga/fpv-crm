import { Quotation } from './types';

export const INITIAL_QUOTATIONS: Quotation[] = [
  {
    id: 1,
    quotationNumber: 'QT-2023-001',
    date: '2023-10-25',
    validUntil: '2023-11-25',
    companyId: 1,
    companyName: 'Astral Limited',
    contactId: 1,
    contactName: 'Rahul Sharma',
    email: 'rahul@astrallimited.com',
    phone: '+91 9876543210',
    billingAddress: 'Astral House, Ahmedabad, Gujarat',
    shippingAddress: 'Plant No. 3, Sanand GIDC, Ahmedabad, Gujarat',
    gstNumber: '24AAACA8711C1ZX',
    state: 'Gujarat',
    paymentTerms: 'Net 30 Days',
    enquiryId: 1,
    enquiryNumber: 'ENQ-2023-001',
    salesExecutiveId: 1,
    salesExecutiveName: 'Shakir Pathan',
    items: [
      {
        productId: 1,
        productName: 'PP Melt Blown Cartridge 1 Micron',
        description: 'High dirt holding capacity 1 micron spun filter cartridge.',
        quantity: 500,
        unit: 'Nos',
        unitPrice: 150,
        discountType: 'percentage',
        discountValue: 10,
        discountAmount: 7500, // (500 * 150) * 0.1
        gstPercent: 18,
        gstAmount: 12150, // (75000 - 7500) * 0.18 = 67500 * 0.18 = 12150
        lineTotal: 79650 // 67500 + 12150
      },
      {
        productId: 3,
        productName: 'Boiler Treatment Chemical',
        description: 'Multipurpose boiler water treatment chemical for scale and corrosion control.',
        quantity: 200,
        unit: 'Kg',
        unitPrice: 240,
        discountType: 'amount',
        discountValue: 1000,
        discountAmount: 1000,
        gstPercent: 18,
        gstAmount: 8460, // (48000 - 1000) * 0.18 = 47000 * 0.18 = 8460
        lineTotal: 55460 // 47000 + 8460
      }
    ],
    subTotal: 123000, // (500*150) + (200*240) = 75000 + 48000
    totalDiscount: 8500, // 7500 + 1000
    taxableAmount: 114500, // 123000 - 8500
    totalGst: 20610, // 12150 + 8460
    additionalCharges: [
      { name: 'Freight & Handling', amount: 2500 }
    ],
    roundOff: -0.10,
    grandTotal: 137610, // 114500 + 20610 + 2500 = 137610
    terms: {
      deliveryPeriod: 'Within 7-10 days from receipt of technically & commercially clear Purchase Order.',
      paymentTerms: '30 days net from the date of invoice.',
      freightTerms: 'Ex-Works basis. Freight extra at actuals.',
      warranty: '12 months from the date of commissioning or 18 months from the date of supply, whichever is earlier.',
      validity: 'Quotation is valid for 30 days from the date of issue.',
      taxes: 'GST extra as applicable at the time of dispatch.',
      installationScope: 'Installation and commissioning will be done by our engineers at extra cost.',
      exclusions: 'Any civil work, piping, cabling outside battery limit is excluded from our scope.',
      generalTerms: 'Subject to force majeure clause and standard terms of sale.'
    },
    status: 'Sent'
  },
  {
    id: 2,
    quotationNumber: 'QT-2023-002',
    date: '2023-10-26',
    validUntil: '2023-11-26',
    companyId: 4,
    companyName: 'Godrej Agrovet Limited',
    contactId: 0, // No primary contacts loaded, we can allow custom contact person input or prefill
    contactName: 'Sanjay Deshmukh',
    email: 'sanjay.deshmukh@godrej.com',
    phone: '+91 22 1234 5678',
    billingAddress: 'Godrej One, Vikhroli, Mumbai, Maharashtra',
    shippingAddress: 'Plant No. 12, GIDC, Valsad, Gujarat',
    gstNumber: '27AAACG1234F1ZA',
    state: 'Maharashtra',
    paymentTerms: 'Advance Payment',
    enquiryId: 2,
    enquiryNumber: 'ENQ-2023-002',
    salesExecutiveId: 2,
    salesExecutiveName: 'Yaseen Shaikh',
    items: [
      {
        productId: 5,
        productName: 'RO Antiscalant',
        description: 'High performance RO membrane antiscalant.',
        quantity: 1000,
        unit: 'Ltr',
        unitPrice: 330,
        discountType: 'percentage',
        discountValue: 12,
        discountAmount: 39600, // (1000 * 330) * 0.12 = 330000 * 0.12 = 39600
        gstPercent: 18,
        gstAmount: 52272, // (330000 - 39600) * 0.18 = 290400 * 0.18 = 52272
        lineTotal: 342672 // 290400 + 52272
      }
    ],
    subTotal: 330000,
    totalDiscount: 39600,
    taxableAmount: 290400,
    totalGst: 52272,
    additionalCharges: [
      { name: 'Transportation Charges', amount: 5000 },
      { name: 'Packing & Forwarding', amount: 1500 }
    ],
    roundOff: 0.28,
    grandTotal: 349172.28, // 290400 + 52272 + 5000 + 1500 = 349172
    terms: {
      deliveryPeriod: 'Within 2-3 weeks from receipt of technically & commercially clear Purchase Order.',
      paymentTerms: '100% advance along with Purchase Order.',
      freightTerms: 'Ex-Works basis. Freight extra at actuals.',
      warranty: 'Standard supplier warranty of 12 months.',
      validity: 'Quotation is valid for 15 days from the date of issue.',
      taxes: 'GST extra as applicable at the time of dispatch.',
      installationScope: 'Not applicable for chemicals supply.',
      exclusions: 'Unloading of chemicals at site is excluded from our scope.',
      generalTerms: 'Subject to force majeure clause and standard terms of sale.'
    },
    status: 'Draft'
  }
];
