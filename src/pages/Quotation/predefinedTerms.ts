export interface TermTemplate {
  label: string;
  value: string;
}

export const PREDEFINED_TERMS = {
  deliveryPeriod: [
    { label: 'Standard Delivery (7-10 Days)', value: 'Within 7-10 days from receipt of technically & commercially clear Purchase Order.' },
    { label: 'Express Delivery (2-3 Days)', value: 'Within 2-3 working days from receipt of technically & commercially clear Purchase Order.' },
    { label: 'Extended Delivery (2-3 Weeks)', value: 'Within 2-3 weeks from receipt of technically & commercially clear Purchase Order.' },
    { label: 'Ex-Stock', value: 'Immediate delivery, subject to prior sale.' }
  ],
  paymentTerms: [
    { label: 'Net 30 Days', value: '30 days net from the date of invoice.' },
    { label: '100% Advance', value: '100% advance along with Purchase Order.' },
    { label: '50% Advance / 50% on Delivery', value: '50% advance payment with order and remaining 50% against delivery proforma.' },
    { label: 'Net 15 Days', value: '15 days net from the date of invoice.' }
  ],
  freightTerms: [
    { label: 'Ex-Works Basis (Freight Extra)', value: 'Ex-Works basis. Freight extra at actuals.' },
    { label: 'F.O.R Destination (Freight Paid)', value: 'F.O.R. destination basis. Freight paid by seller.' },
    { label: 'To-Pay Basis (By Customer)', value: 'To-Pay basis. Freight will be paid directly by the customer to the carrier.' }
  ],
  warranty: [
    { label: 'Standard 12 Months', value: '12 months from the date of commissioning or 18 months from the date of supply, whichever is earlier.' },
    { label: 'Extended 24 Months', value: '24 months from the date of commissioning or 30 months from the date of supply, whichever is earlier.' },
    { label: 'No Warranty (Consumables)', value: 'Consumable item. No warranty is applicable.' },
    { label: '6 Months Warranty', value: '6 months from the date of supply.' }
  ],
  validity: [
    { label: 'Valid for 30 Days', value: 'Quotation is valid for 30 days from the date of issue.' },
    { label: 'Valid for 15 Days', value: 'Quotation is valid for 15 days from the date of issue.' },
    { label: 'Valid for 7 Days', value: 'Quotation is valid for 7 days from the date of issue due to raw material price volatility.' }
  ],
  taxes: [
    { label: 'GST Extra as applicable', value: 'GST extra as applicable at the time of dispatch (Currently 18%).' },
    { label: 'Inclusive of Taxes', value: 'All prices quoted are inclusive of GST.' },
    { label: 'Taxes Extra at Actuals', value: 'All statutory taxes, duties, and levies extra as applicable at actuals at the time of dispatch.' }
  ],
  installationScope: [
    { label: 'Standard Commissioning Included', value: 'Installation and commissioning will be done by our service engineers. Local boarding, lodging, and local travel to be provided by the customer.' },
    { label: 'Not in Scope', value: 'Installation, commissioning, and supervision are not included in our scope of supply.' },
    { label: 'Supervision Only', value: 'Only supervision of installation and commissioning will be provided by our engineer. Manpower and tools to be arranged by the customer.' }
  ],
  exclusions: [
    { label: 'Standard Exclusions', value: 'Any civil work, piping, cabling, structural work outside the battery limit is excluded from our scope.' },
    { label: 'Unloading & Handling Excluded', value: 'Unloading of material, shifting, positioning, and safe custody of material at site is excluded from our scope.' },
    { label: 'All Civil Work Excluded', value: 'Civil foundation design, civil work, water and power supply to the battery limit are in the customer scope.' }
  ],
  generalTerms: [
    { label: 'Standard Force Majeure', value: 'Our offer is subject to force majeure clause and standard terms of sales.' },
    { label: 'Subject to Local Jurisdiction', value: 'All transactions are subject to local judicial jurisdiction only.' },
    { label: 'Standard Offer Terms', value: 'Prices are subject to revision if any technical parameters change during project discussions.' }
  ]
};
