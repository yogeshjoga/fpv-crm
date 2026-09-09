import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Trash2, HelpCircle, FileText, CheckCircle, 
  User, Building2, MapPin, ClipboardList, Info, DollarSign, ListOrdered, Settings
} from 'lucide-react';
import { Quotation, QuotationLineItem, AdditionalCharge, QuotationTerms } from './types';
import { MOCK_PARTNERS, MOCK_PRODUCTS, MOCK_ENQUIRIES, MOCK_USERS } from '../../data/mockData';
import { PREDEFINED_TERMS } from './predefinedTerms';

interface NewQuotationProps {
  quotationToEdit?: Quotation;
  onBack: () => void;
  onSave: (quote: Quotation) => void;
}

export function NewQuotation({ quotationToEdit, onBack, onSave }: NewQuotationProps) {
  // 1. Core Header State
  const [quotationNumber, setQuotationNumber] = useState('');
  const [date, setDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [enquiryId, setEnquiryId] = useState<number>(0);
  const [companyId, setCompanyId] = useState<number>(0);
  const [contactId, setContactId] = useState<number>(0);
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [stateName, setStateName] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [salesExecutiveId, setSalesExecutiveId] = useState<number>(1);

  // 2. Dynamic Product Lines State
  const [items, setItems] = useState<QuotationLineItem[]>([]);

  // 3. Additional Charges State
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([]);

  // 4. Terms and Conditions State
  const [terms, setTerms] = useState<QuotationTerms>({
    deliveryPeriod: '',
    paymentTerms: '',
    freightTerms: '',
    warranty: '',
    validity: '',
    taxes: '',
    installationScope: '',
    exclusions: '',
    generalTerms: ''
  });

  const [status, setStatus] = useState<Quotation['status']>('Draft');

  // Initialize fields (Auto-generation for new, or load edit values)
  useEffect(() => {
    if (quotationToEdit) {
      setQuotationNumber(quotationToEdit.quotationNumber);
      setDate(quotationToEdit.date);
      setValidUntil(quotationToEdit.validUntil);
      setEnquiryId(quotationToEdit.enquiryId || 0);
      setCompanyId(quotationToEdit.companyId);
      setContactId(quotationToEdit.contactId || 0);
      setContactName(quotationToEdit.contactName || '');
      setEmail(quotationToEdit.email || '');
      setPhone(quotationToEdit.phone || '');
      setBillingAddress(quotationToEdit.billingAddress || '');
      setShippingAddress(quotationToEdit.shippingAddress || '');
      setGstNumber(quotationToEdit.gstNumber || '');
      setStateName(quotationToEdit.state || '');
      setPaymentTerms(quotationToEdit.paymentTerms || '');
      setSalesExecutiveId(quotationToEdit.salesExecutiveId);
      setItems(quotationToEdit.items);
      setAdditionalCharges(quotationToEdit.additionalCharges);
      setTerms(quotationToEdit.terms);
      setStatus(quotationToEdit.status);
    } else {
      // Create new quotation initialization
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const generatedNumber = `QT-2026-${randomSuffix}`;
      setQuotationNumber(generatedNumber);
      
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      
      // Validity 30 days default
      const validityDate = new Date();
      validityDate.setDate(validityDate.getDate() + 30);
      setValidUntil(validityDate.toISOString().split('T')[0]);

      // Initialize with one blank row
      setItems([{
        productId: 0,
        productName: '',
        description: '',
        quantity: 1,
        unit: 'Nos',
        unitPrice: 0,
        discountType: 'percentage',
        discountValue: 0,
        discountAmount: 0,
        gstPercent: 18,
        gstAmount: 0,
        lineTotal: 0
      }]);

      // Pre-populate terms with first templates
      setTerms({
        deliveryPeriod: PREDEFINED_TERMS.deliveryPeriod[0].value,
        paymentTerms: PREDEFINED_TERMS.paymentTerms[0].value,
        freightTerms: PREDEFINED_TERMS.freightTerms[0].value,
        warranty: PREDEFINED_TERMS.warranty[0].value,
        validity: PREDEFINED_TERMS.validity[0].value,
        taxes: PREDEFINED_TERMS.taxes[0].value,
        installationScope: PREDEFINED_TERMS.installationScope[0].value,
        exclusions: PREDEFINED_TERMS.exclusions[0].value,
        generalTerms: PREDEFINED_TERMS.generalTerms[0].value
      });
    }
  }, [quotationToEdit]);

  // Handle Business Partner (Customer) selection and autofill
  const handlePartnerChange = (partnerId: number) => {
    setCompanyId(partnerId);
    if (partnerId === 0) {
      setContactId(0);
      setContactName('');
      setEmail('');
      setPhone('');
      setBillingAddress('');
      setGstNumber('');
      setStateName('');
      setPaymentTerms('');
      return;
    }

    const partner = MOCK_PARTNERS.find(p => p.id === partnerId);
    if (partner) {
      setBillingAddress(partner.address || `${partner.name} Office, ${partner.city}`);
      setGstNumber(partner.gst || `${Math.floor(10 + Math.random() * 89)}AAACG${Math.floor(1000 + Math.random() * 8999)}F1Z${Math.floor(Math.random() * 9)}`);
      setStateName(partner.city === 'Mumbai' || partner.city === 'Pune' || partner.city === 'Satara' ? 'Maharashtra' : 'Gujarat');
      setPaymentTerms(partner.paymentTerms || 'Net 30 Days');

      // Setup contacts
      if (partner.contacts && partner.contacts.length > 0) {
        const primaryContact = partner.contacts.find(c => c.isPrimary) || partner.contacts[0];
        setContactId(primaryContact.id);
        setContactName(primaryContact.name);
        setEmail(primaryContact.email);
        setPhone(primaryContact.phone);
      } else {
        setContactId(0);
        setContactName('');
        setEmail(partner.email || '');
        setPhone(partner.phone || '');
      }
    }
  };

  // Handle Contact selection of the chosen company
  const handleContactChange = (cId: number) => {
    setContactId(cId);
    const partner = MOCK_PARTNERS.find(p => p.id === companyId);
    if (partner && partner.contacts) {
      const contact = partner.contacts.find(c => c.id === cId);
      if (contact) {
        setContactName(contact.name);
        setEmail(contact.email);
        setPhone(contact.phone);
      }
    }
  };

  // Handle Reference Enquiry selection and load items + client info
  const handleEnquiryChange = (enqId: number) => {
    setEnquiryId(enqId);
    if (enqId === 0) return;

    const enquiry = MOCK_ENQUIRIES.find(e => e.id === enqId);
    if (enquiry) {
      // Autofill customer company info
      handlePartnerChange(enquiry.companyId);

      // Autofill contact if exists
      if (enquiry.contactId) {
        setTimeout(() => {
          handleContactChange(enquiry.contactId!);
        }, 50);
      }

      // Convert enquiry items into quotation line items!
      const newItems = enquiry.items.map(enqItem => {
        // Find product details
        const product = MOCK_PRODUCTS.find(p => p.id === enqItem.productId || p.name === enqItem.product);
        const standardPrice = product?.standardSellingPrice || enqItem.targetPrice || 100;
        const gst = product?.gst || 18;
        const desc = product?.description || enqItem.remarks || `${enqItem.product} - Premium Industrial Supply`;

        // Calculate discount and GST
        const lineSubtotal = enqItem.quantity * standardPrice;
        const discountAmt = 0; // standard default
        const taxable = lineSubtotal - discountAmt;
        const gstAmt = taxable * (gst / 100);

        return {
          productId: product?.id || 0,
          productName: product?.name || enqItem.product,
          description: desc,
          quantity: enqItem.quantity,
          unit: enqItem.unit || product?.unit || 'Nos',
          unitPrice: standardPrice,
          discountType: 'percentage' as const,
          discountValue: 0,
          discountAmount: discountAmt,
          gstPercent: gst,
          gstAmount: gstAmt,
          lineTotal: taxable + gstAmt
        };
      });

      if (newItems.length > 0) {
        setItems(newItems);
      }
    }
  };

  // Product Row updates
  const handleProductRowChange = (index: number, field: keyof QuotationLineItem, value: any) => {
    const updatedItems = [...items];
    const item = { ...updatedItems[index] };

    if (field === 'productId') {
      const pId = Number(value);
      item.productId = pId;
      const product = MOCK_PRODUCTS.find(p => p.id === pId);
      if (product) {
        item.productName = product.name;
        item.description = product.description;
        item.unit = product.unit;
        item.unitPrice = product.standardSellingPrice || 0;
        item.gstPercent = product.gst;
      }
    } else {
      (item as any)[field] = value;
    }

    // Re-calculate row values
    const qty = Number(item.quantity || 0);
    const price = Number(item.unitPrice || 0);
    const rawSubtotal = qty * price;

    let discountAmt = 0;
    const discVal = Number(item.discountValue || 0);
    if (item.discountType === 'percentage') {
      discountAmt = rawSubtotal * (discVal / 100);
    } else {
      discountAmt = discVal;
    }

    item.discountAmount = discountAmt;
    const taxableLine = Math.max(0, rawSubtotal - discountAmt);
    const gstPercent = Number(item.gstPercent || 0);
    item.gstAmount = taxableLine * (gstPercent / 100);
    item.lineTotal = taxableLine + item.gstAmount;

    updatedItems[index] = item;
    setItems(updatedItems);
  };

  // ➕ Add dynamic product row
  const addProductRow = () => {
    setItems([...items, {
      productId: 0,
      productName: '',
      description: '',
      quantity: 1,
      unit: 'Nos',
      unitPrice: 0,
      discountType: 'percentage',
      discountValue: 0,
      discountAmount: 0,
      gstPercent: 18,
      gstAmount: 0,
      lineTotal: 0
    }]);
  };

  // ❌ Remove product row
  const removeProductRow = (index: number) => {
    if (items.length === 1) {
      alert("Quotation must have at least one product row.");
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Additional Charges handlers
  const handleAddChargeRow = () => {
    setAdditionalCharges([...additionalCharges, { name: 'Freight Charges', amount: 0 }]);
  };

  const handleRemoveChargeRow = (index: number) => {
    setAdditionalCharges(additionalCharges.filter((_, i) => i !== index));
  };

  const handleChargeChange = (index: number, field: keyof AdditionalCharge, value: any) => {
    const updated = [...additionalCharges];
    if (field === 'amount') {
      updated[index].amount = Number(value);
    } else {
      updated[index].name = value.toString();
    }
    setAdditionalCharges(updated);
  };

  // Overall Financial summary calculations
  const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const taxableAmount = subTotal - totalDiscount;
  const totalGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
  const totalCharges = additionalCharges.reduce((sum, c) => sum + c.amount, 0);
  
  const rawGrandTotal = taxableAmount + totalGst + totalCharges;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));

  // Save changes
  const handleSaveQuotation = () => {
    if (companyId === 0) {
      alert("Please select a Business Partner (Customer).");
      return;
    }

    const invalidItem = items.find(item => item.productId === 0 || item.quantity <= 0);
    if (invalidItem) {
      alert("Please select a valid product and positive quantity for all rows.");
      return;
    }

    const partnerName = MOCK_PARTNERS.find(p => p.id === companyId)?.name || 'Unknown Partner';
    const execName = MOCK_USERS.find(u => u.id === salesExecutiveId)?.name || 'Sales Team';

    const quotation: Quotation = {
      id: quotationToEdit?.id || Math.floor(1000 + Math.random() * 9000),
      quotationNumber,
      date,
      validUntil,
      companyId,
      companyName: partnerName,
      contactId: contactId || undefined,
      contactName,
      email,
      phone,
      billingAddress,
      shippingAddress,
      gstNumber,
      state: stateName,
      paymentTerms,
      enquiryId: enquiryId || undefined,
      enquiryNumber: enquiryId ? MOCK_ENQUIRIES.find(e => e.id === enquiryId)?.enquiryNumber : undefined,
      salesExecutiveId,
      salesExecutiveName: execName,
      items,
      subTotal,
      totalDiscount,
      taxableAmount,
      totalGst,
      additionalCharges,
      roundOff,
      grandTotal,
      terms,
      status
    };

    onSave(quotation);
  };

  // Get current partner's contacts if any
  const currentPartnerContacts = MOCK_PARTNERS.find(p => p.id === companyId)?.contacts || [];

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              {quotationToEdit ? `Edit Quotation: ${quotationToEdit.quotationNumber}` : 'Create New Quotation'}
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Draft professional sales quotation which automatically integrates products and business partners.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="px-4 py-2 bg-white border border-neutral-200 rounded-full text-xs font-semibold focus:ring-1 focus:ring-neutral-800 focus:outline-none cursor-pointer"
          >
            <option value="Draft">Save as Draft</option>
            <option value="Sent">Mark as Sent</option>
            <option value="Approved">Approved</option>
            <option value="Expired">Expired</option>
          </select>
          
          <button
            onClick={handleSaveQuotation}
            className="px-6 py-2 bg-neutral-900 text-white hover:bg-black rounded-full text-xs font-semibold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle size={14} />
            <span>Save Quotation</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Quote Headers, Items, Extra Charges */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Header Metadata Section */}
          <div className="bg-white border border-neutral-200 p-6 rounded-[2rem] shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-100">
              <ClipboardList className="text-neutral-500" size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-600">Quotation Header</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              
              {/* Quote Number */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">Quotation Number (Auto)</label>
                <input
                  type="text"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-mono font-medium text-neutral-800"
                />
              </div>

              {/* Quotation Date */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">Quotation Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium"
                />
              </div>

              {/* Valid Until */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">Valid Until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium"
                />
              </div>

              {/* Reference Enquiry Selector */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">Reference Enquiry (Interconnected)</label>
                <select
                  value={enquiryId}
                  onChange={(e) => handleEnquiryChange(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800"
                >
                  <option value={0}>-- Select Enquiry (Auto Populate) --</option>
                  {MOCK_ENQUIRIES.map((enq) => (
                    <option key={enq.id} value={enq.id}>
                      {enq.enquiryNumber} - {MOCK_PARTNERS.find(p => p.id === enq.companyId)?.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sales Executive Selector */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">Sales Executive / Assigned To</label>
                <select
                  value={salesExecutiveId}
                  onChange={(e) => setSalesExecutiveId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800"
                >
                  {MOCK_USERS.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Terms Input */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">Default Payment Terms</label>
                <input
                  type="text"
                  placeholder="e.g. 100% Advance, Net 30"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800"
                />
              </div>

            </div>
          </div>

          {/* Business Partner (Customer) Info Panel */}
          <div className="bg-white border border-neutral-200 p-6 rounded-[2rem] shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Building2 className="text-neutral-500" size={18} />
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-600">Customer & Billing Details</h2>
              </div>
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">Auto-Fills on select</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              
              {/* Business Partner select */}
              <div className="md:col-span-2">
                <label className="block text-neutral-500 font-bold mb-1.5">Business Partner (Customer Company)</label>
                <select
                  value={companyId}
                  onChange={(e) => handlePartnerChange(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800"
                >
                  <option value={0}>-- Select Company --</option>
                  {MOCK_PARTNERS.filter(p => p.type === 'Customer' || p.type === 'Both').map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.city})</option>
                  ))}
                </select>
              </div>

              {/* Contact Person dropdown */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">Contact Person</label>
                {currentPartnerContacts.length > 0 ? (
                  <select
                    value={contactId}
                    onChange={(e) => handleContactChange(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800"
                  >
                    <option value={0}>Custom Contact...</option>
                    {currentPartnerContacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.designation})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter contact name"
                    value={contactName}
                    onChange={(e) => {
                      setContactName(e.target.value);
                      setContactId(0);
                    }}
                    className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800"
                  />
                )}
              </div>

              {/* Direct Custom Contact details if Custom chosen */}
              {contactId === 0 && currentPartnerContacts.length > 0 && (
                <div>
                  <label className="block text-neutral-500 font-bold mb-1.5">Contact Name</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium"
                  />
                </div>
              )}

              {/* Contact Email */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">Email Address</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800"
                />
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 9999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800"
                />
              </div>

              {/* GST Number */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">GST Number</label>
                <input
                  type="text"
                  placeholder="15-digit GSTIN"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-mono font-semibold text-neutral-800 uppercase"
                />
              </div>

              {/* Place of Supply (State) */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1.5">State (Place of Supply)</label>
                <select
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800"
                >
                  <option value="">-- Choose State --</option>
                  <option value="Gujarat">Gujarat (24)</option>
                  <option value="Maharashtra">Maharashtra (27)</option>
                  <option value="Delhi">Delhi (07)</option>
                  <option value="Karnataka">Karnataka (29)</option>
                  <option value="Telangana">Telangana (36)</option>
                  <option value="Tamil Nadu">Tamil Nadu (33)</option>
                </select>
              </div>

              {/* Billing Address */}
              <div className="md:col-span-2">
                <label className="block text-neutral-500 font-bold mb-1.5">Billing Address</label>
                <textarea
                  rows={2}
                  placeholder="Full office billing address..."
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800 text-xs"
                />
              </div>

              {/* Shipping Address */}
              <div className="md:col-span-3">
                <label className="block text-neutral-500 font-bold mb-1.5">Shipping Address (Optional - defaults to billing if blank)</label>
                <textarea
                  rows={2}
                  placeholder="If delivery is to a different branch/factory, enter here..."
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium text-neutral-800 text-xs"
                />
              </div>

            </div>
          </div>

          {/* Dynamic Product rows section */}
          <div className="bg-white border border-neutral-200 p-6 rounded-[2rem] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <ListOrdered className="text-neutral-500" size={18} />
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-600">Product List & Quoted Prices</h2>
              </div>
              <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded-full">Internal costs hidden</span>
            </div>

            {/* Product list table */}
            <div className="flex flex-col gap-3">
              {items.map((item, idx) => (
                <div 
                  key={idx} 
                  className="p-4 bg-neutral-50 border border-neutral-100 rounded-2xl flex flex-col gap-3 relative group"
                >
                  {/* Delete row button */}
                  <button
                    onClick={() => removeProductRow(idx)}
                    type="button"
                    className="absolute top-4 right-4 p-1.5 bg-white border border-neutral-200 rounded-lg text-neutral-400 hover:text-rose-600 hover:border-rose-100 transition-colors shadow-sm"
                    title="Remove Product"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                    
                    {/* Index label */}
                    <div className="md:col-span-1 flex items-center">
                      <span className="w-6 h-6 rounded-full bg-neutral-200/60 text-neutral-600 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Product Selector */}
                    <div className="md:col-span-5">
                      <label className="block text-neutral-500 font-bold mb-1">Select Product</label>
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductRowChange(idx, 'productId', e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-medium"
                      >
                        <option value={0}>-- Select Product --</option>
                        {MOCK_PRODUCTS.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.code}] {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Unit */}
                    <div className="md:col-span-2">
                      <label className="block text-neutral-500 font-bold mb-1">Unit</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleProductRowChange(idx, 'unit', e.target.value)}
                        className="w-full px-2 py-2 bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-600 font-medium cursor-not-allowed"
                        readOnly
                      />
                    </div>

                    {/* Quantity */}
                    <div className="md:col-span-2">
                      <label className="block text-neutral-500 font-bold mb-1">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleProductRowChange(idx, 'quantity', Number(e.target.value))}
                        className="w-full px-2 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-semibold font-mono"
                      />
                    </div>

                    {/* Unit Selling Price */}
                    <div className="md:col-span-2">
                      <label className="block text-neutral-500 font-bold mb-1">Unit Price (INR)</label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => handleProductRowChange(idx, 'unitPrice', Number(e.target.value))}
                        className="w-full px-2 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 font-semibold font-mono text-blue-600"
                      />
                    </div>

                  </div>

                  {/* Description, Discount, Tax and Line Total row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs border-t border-neutral-200/60 pt-3">
                    
                    {/* Placeholder */}
                    <div className="md:col-span-1 hidden md:block"></div>

                    {/* Editable Description */}
                    <div className="md:col-span-5">
                      <label className="block text-neutral-400 font-semibold mb-1">Custom Item Description</label>
                      <input
                        type="text"
                        placeholder="Quotation description or specs..."
                        value={item.description}
                        onChange={(e) => handleProductRowChange(idx, 'description', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 text-[11px] text-neutral-600"
                      />
                    </div>

                    {/* Discount Controls */}
                    <div className="md:col-span-4 flex gap-2">
                      <div className="w-1/2">
                        <label className="block text-neutral-400 font-semibold mb-1">Discount Type</label>
                        <select
                          value={item.discountType}
                          onChange={(e) => handleProductRowChange(idx, 'discountType', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 text-[11px]"
                        >
                          <option value="percentage">% Percent</option>
                          <option value="amount">Flat Amt</option>
                        </select>
                      </div>

                      <div className="w-1/2">
                        <label className="block text-neutral-400 font-semibold mb-1">Discount Value</label>
                        <input
                          type="number"
                          min={0}
                          value={item.discountValue}
                          onChange={(e) => handleProductRowChange(idx, 'discountValue', Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 text-[11px] font-mono font-semibold"
                        />
                      </div>
                    </div>

                    {/* Tax GST% */}
                    <div className="md:col-span-1">
                      <label className="block text-neutral-400 font-semibold mb-1">GST %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.gstPercent}
                        onChange={(e) => handleProductRowChange(idx, 'gstPercent', Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-800 text-[11px] font-mono"
                      />
                    </div>

                    {/* Line Total display */}
                    <div className="md:col-span-1.5 text-right flex flex-col justify-end">
                      <span className="text-[10px] text-neutral-400 font-bold">Line Total</span>
                      <span className="font-mono text-xs font-bold text-neutral-900 pt-1">
                        ₹{Math.round(item.lineTotal).toLocaleString('en-IN')}
                      </span>
                    </div>

                  </div>

                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex justify-between items-center border-t border-neutral-100 pt-3 mt-1">
              <button
                type="button"
                onClick={addProductRow}
                className="inline-flex items-center gap-1 text-xs font-bold text-neutral-800 hover:text-black hover:underline"
              >
                <Plus size={14} /> Add Product Row
              </button>
              
              <span className="text-xs text-neutral-500">
                Total Taxable Amount: <strong className="text-neutral-800">₹{Math.round(taxableAmount).toLocaleString('en-IN')}</strong>
              </span>
            </div>
          </div>

          {/* Additional Charges Section */}
          <div className="bg-white border border-neutral-200 p-6 rounded-[2rem] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <DollarSign className="text-neutral-500" size={18} />
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-600">Additional Charges (Freight, Unloading, Handling, etc)</h2>
              </div>
              <button
                type="button"
                onClick={handleAddChargeRow}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
              >
                <Plus size={14} /> Add Charge
              </button>
            </div>

            {additionalCharges.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-2">
                No extra charges defined. Click "Add Charge" if you want to include freight, transportation, packing, or installation charges.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {additionalCharges.map((charge, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                    <select
                      value={charge.name}
                      onChange={(e) => handleChargeChange(idx, 'name', e.target.value)}
                      className="px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-medium w-1/2 focus:outline-none"
                    >
                      <option value="Freight & Forwarding">Freight & Forwarding</option>
                      <option value="Transportation Charges">Transportation Charges</option>
                      <option value="Packing & Handling">Packing & Handling</option>
                      <option value="Installation Charges">Installation Charges</option>
                      <option value="Commissioning Charges">Commissioning Charges</option>
                      <option value="Delivery Charges">Delivery Charges</option>
                      <option value="Other Charges">Other Charges</option>
                    </select>

                    <input
                      type="number"
                      placeholder="Amount (INR)"
                      value={charge.amount}
                      onChange={(e) => handleChargeChange(idx, 'amount', e.target.value)}
                      className="px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono font-semibold w-1/3 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveChargeRow(idx)}
                      className="text-neutral-400 hover:text-rose-600 p-1 rounded-lg"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right 1 Column: Summary, Terms & Conditions Selection Templates */}
        <div className="flex flex-col gap-6">
          
          {/* Summary Box Card */}
          <div className="bg-[#1a1a1a] text-white p-6 rounded-[2rem] shadow-lg flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-2">
              Quotation Summary
            </h3>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Items Gross Subtotal:</span>
                <span className="font-mono">₹{Math.round(subTotal).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-amber-400">
                <span>Total Item Discounts:</span>
                <span className="font-mono">-₹{Math.round(totalDiscount).toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-neutral-800 my-1"></div>
              
              <div className="flex justify-between font-semibold">
                <span>Taxable Value (Net):</span>
                <span className="font-mono">₹{Math.round(taxableAmount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>IGST/CGST/SGST Tax (18%):</span>
                <span className="font-mono">₹{Math.round(totalGst).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Additional Charges:</span>
                <span className="font-mono">₹{totalCharges.toLocaleString('en-IN')}</span>
              </div>
              {roundOff !== 0 && (
                <div className="flex justify-between text-neutral-400">
                  <span>Round Off:</span>
                  <span className="font-mono">{roundOff > 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}</span>
                </div>
              )}
            </div>

            <div className="border-t border-neutral-800 my-2 pt-3 flex flex-col gap-1">
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Grand Total (Rounded)</span>
              <span className="font-display text-3xl font-extrabold tracking-tight text-white font-mono">
                ₹{grandTotal.toLocaleString('en-IN')}/-
              </span>
            </div>

            <button
              onClick={handleSaveQuotation}
              className="w-full py-3 bg-white text-neutral-900 hover:bg-neutral-100 rounded-xl text-xs font-bold transition-all shadow-md active:scale-98 text-center mt-3"
            >
              Confirm & Save Quotation
            </button>
          </div>

          {/* Terms & Conditions Template Picker */}
          <div className="bg-white border border-neutral-200 p-6 rounded-[2rem] shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
              <Settings className="text-neutral-500" size={18} />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-600">Terms Templates</h2>
            </div>
            
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Select predefined templates to fill in standard contract text instantly. You can always edit the generated wording.
            </p>

            <div className="flex flex-col gap-3 text-xs">
              
              {/* Delivery Period Template */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1">Delivery Period Template</label>
                <select
                  onChange={(e) => setTerms({ ...terms, deliveryPeriod: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Delivery Period Template --</option>
                  {PREDEFINED_TERMS.deliveryPeriod.map((t, i) => (
                    <option key={i} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={terms.deliveryPeriod || ''}
                  onChange={(e) => setTerms({ ...terms, deliveryPeriod: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] mt-1.5 focus:outline-none"
                />
              </div>

              {/* Payment Terms Template */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1">Payment Terms Template</label>
                <select
                  onChange={(e) => setTerms({ ...terms, paymentTerms: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Payment Terms Template --</option>
                  {PREDEFINED_TERMS.paymentTerms.map((t, i) => (
                    <option key={i} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={terms.paymentTerms || ''}
                  onChange={(e) => setTerms({ ...terms, paymentTerms: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] mt-1.5 focus:outline-none"
                />
              </div>

              {/* Freight Terms Template */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1">Freight Terms Template</label>
                <select
                  onChange={(e) => setTerms({ ...terms, freightTerms: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Freight Terms Template --</option>
                  {PREDEFINED_TERMS.freightTerms.map((t, i) => (
                    <option key={i} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={terms.freightTerms || ''}
                  onChange={(e) => setTerms({ ...terms, freightTerms: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] mt-1.5 focus:outline-none"
                />
              </div>

              {/* Warranty Template */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1">Warranty Period Template</label>
                <select
                  onChange={(e) => setTerms({ ...terms, warranty: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Warranty Template --</option>
                  {PREDEFINED_TERMS.warranty.map((t, i) => (
                    <option key={i} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={terms.warranty || ''}
                  onChange={(e) => setTerms({ ...terms, warranty: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] mt-1.5 focus:outline-none"
                />
              </div>

              {/* Validity Template */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1">Validity Template</label>
                <select
                  onChange={(e) => setTerms({ ...terms, validity: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Validity Template --</option>
                  {PREDEFINED_TERMS.validity.map((t, i) => (
                    <option key={i} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={1}
                  value={terms.validity || ''}
                  onChange={(e) => setTerms({ ...terms, validity: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] mt-1.5 focus:outline-none"
                />
              </div>

              {/* Taxes Extra / Inclusive */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1">Taxes Extra / Inclusive</label>
                <select
                  onChange={(e) => setTerms({ ...terms, taxes: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Taxes Template --</option>
                  {PREDEFINED_TERMS.taxes.map((t, i) => (
                    <option key={i} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={1}
                  value={terms.taxes || ''}
                  onChange={(e) => setTerms({ ...terms, taxes: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] mt-1.5 focus:outline-none"
                />
              </div>

              {/* Installation Scope */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1">Installation & Commissioning Scope</label>
                <select
                  onChange={(e) => setTerms({ ...terms, installationScope: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Installation Template --</option>
                  {PREDEFINED_TERMS.installationScope.map((t, i) => (
                    <option key={i} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={terms.installationScope || ''}
                  onChange={(e) => setTerms({ ...terms, installationScope: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] mt-1.5 focus:outline-none"
                />
              </div>

              {/* Exclusions */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1">Scope Exclusions</label>
                <select
                  onChange={(e) => setTerms({ ...terms, exclusions: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Exclusions Template --</option>
                  {PREDEFINED_TERMS.exclusions.map((t, i) => (
                    <option key={i} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={terms.exclusions || ''}
                  onChange={(e) => setTerms({ ...terms, exclusions: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] mt-1.5 focus:outline-none"
                />
              </div>

              {/* General Terms */}
              <div>
                <label className="block text-neutral-500 font-bold mb-1">General Terms & Conditions</label>
                <select
                  onChange={(e) => setTerms({ ...terms, generalTerms: e.target.value })}
                  className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select General Terms Template --</option>
                  {PREDEFINED_TERMS.generalTerms.map((t, i) => (
                    <option key={i} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={terms.generalTerms || ''}
                  onChange={(e) => setTerms({ ...terms, generalTerms: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] mt-1.5 focus:outline-none"
                />
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
