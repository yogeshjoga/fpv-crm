export interface QuotationLineItem {
  productId: number;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountType: 'percentage' | 'amount';
  discountValue: number; // raw value entered
  discountAmount: number; // calculated discount amount
  gstPercent: number;
  gstAmount: number;
  lineTotal: number;
}

export interface AdditionalCharge {
  name: string;
  amount: number;
}

export interface QuotationTerms {
  deliveryPeriod?: string;
  paymentTerms?: string;
  freightTerms?: string;
  warranty?: string;
  validity?: string;
  taxes?: string;
  installationScope?: string;
  exclusions?: string;
  generalTerms?: string;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  date: string;
  validUntil: string;
  companyId: number;
  companyName: string;
  contactId?: number;
  contactName?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstNumber?: string;
  state?: string;
  paymentTerms?: string;
  enquiryId?: number;
  enquiryNumber?: string;
  salesExecutiveId: number;
  salesExecutiveName: string;
  items: QuotationLineItem[];
  subTotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalGst: number;
  additionalCharges: AdditionalCharge[];
  roundOff: number;
  grandTotal: number;
  terms: QuotationTerms;
  status: 'Draft' | 'Sent' | 'Approved' | 'Expired';
}
