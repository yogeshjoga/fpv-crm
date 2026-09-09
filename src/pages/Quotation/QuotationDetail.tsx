import React from 'react';
import { 
  ArrowLeft, Printer, FileDown, Mail, MessageSquare, Edit3, 
  CheckCircle, Building2, User, Calendar, ShieldAlert, Check
} from 'lucide-react';
import { Quotation } from './types';
import { MOCK_USERS } from '../../data/mockData';

interface QuotationDetailProps {
  quotation: Quotation;
  onBack: () => void;
  onEdit: () => void;
  onStatusChange: (status: Quotation['status']) => void;
}

// Helper to convert number to Indian currency text words
function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  
  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const doubleDigits = ['', 'Ten', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  const convertLessThanThousand = (n: number): string => {
    let str = '';
    if (n >= 100) {
      str += singleDigits[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 10 && n < 20) {
      str += teenDigits[n - 10] + ' ';
    } else if (n >= 20) {
      str += doubleDigits[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0 && n < 10) {
      str += singleDigits[n] + ' ';
    }
    return str;
  };

  let word = '';
  let integerPart = Math.floor(num);
  
  if (integerPart >= 10000000) {
    word += convertLessThanThousand(Math.floor(integerPart / 10000000)) + 'Crore ';
    integerPart %= 10000000;
  }
  if (integerPart >= 100000) {
    word += convertLessThanThousand(Math.floor(integerPart / 100000)) + 'Lakh ';
    integerPart %= 100000;
  }
  if (integerPart >= 1000) {
    word += convertLessThanThousand(Math.floor(integerPart / 1000)) + 'Thousand ';
    integerPart %= 1000;
  }
  if (integerPart > 0) {
    word += convertLessThanThousand(integerPart);
  }

  return word.trim() + ' Rupees Only';
}

export function QuotationDetail({ quotation, onBack, onEdit, onStatusChange }: QuotationDetailProps) {
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value);
  };

  // State-based TAX splits (Gujarat is supplier's state)
  const isLocalState = quotation.state === 'Gujarat';
  const cgstAmount = isLocalState ? (quotation.totalGst / 2) : 0;
  const sgstAmount = isLocalState ? (quotation.totalGst / 2) : 0;
  const igstAmount = isLocalState ? 0 : quotation.totalGst;

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = () => {
    alert(`Quotation ${quotation.quotationNumber} has been successfully compiled into PDF and emailed to ${quotation.email || 'customer'}!`);
  };

  const handleSendWhatsApp = () => {
    const message = `Hello, please find our official quotation ${quotation.quotationNumber} of value ${formatCurrency(quotation.grandTotal)} attached. Valid until ${quotation.validUntil}.`;
    const url = `https://api.whatsapp.com/send?phone=${encodeURIComponent(quotation.phone || '')}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto print:p-0 pb-16">
      
      {/* Detail view header - hidden on print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5 print:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-neutral-900">Quotation Document</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
                {quotation.status}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Ref: <span className="font-mono">{quotation.quotationNumber}</span> | Issued on {quotation.date}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="p-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Edit3 size={14} />
            <span>Edit Quote</span>
          </button>
          
          <button
            onClick={handlePrint}
            className="p-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Printer size={14} />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={handleSendEmail}
            className="p-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Mail size={14} />
            <span>Email Client</span>
          </button>

          {quotation.phone && (
            <button
              onClick={handleSendWhatsApp}
              className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <MessageSquare size={14} />
              <span>WhatsApp</span>
            </button>
          )}

          <div className="h-6 w-px bg-neutral-200 mx-1"></div>

          {/* Quick status approved */}
          {quotation.status !== 'Approved' && (
            <button
              onClick={() => onStatusChange('Approved')}
              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>Approve Deal</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Printable Area */}
      <div className="bg-white border border-neutral-200 rounded-[2rem] shadow-sm p-8 md:p-12 print:border-none print:shadow-none print:p-0 font-sans text-neutral-800">
        
        {/* Document Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-neutral-200 pb-8">
          <div>
            {/* SP CRM Logo placeholder */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center text-white font-extrabold text-sm tracking-tight">
                SP
              </div>
              <span className="font-display font-black text-lg tracking-tight text-neutral-900">SP CRM Limited</span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm">
              401, Stellar Corporate Heights, Near Iscon Circle,<br />
              S.G. Highway, Ahmedabad - 380015, Gujarat, India.<br />
              Email: contact@spcrm.com | GSTIN: 24AAACS9981E1Z0
            </p>
          </div>

          <div className="text-left md:text-right flex flex-col gap-1.5">
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 uppercase">
              Sales Quotation
            </h1>
            <div className="text-xs text-neutral-600 font-mono">
              <div><strong className="text-neutral-800">Quote No:</strong> {quotation.quotationNumber}</div>
              <div><strong className="text-neutral-800">Date:</strong> {quotation.date}</div>
              <div><strong className="text-neutral-800">Valid Until:</strong> {quotation.validUntil}</div>
              {quotation.enquiryNumber && (
                <div><strong className="text-neutral-800">Ref Enquiry:</strong> {quotation.enquiryNumber}</div>
              )}
            </div>
          </div>
        </div>

        {/* Customer & Billing/Shipping Side-By-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-b border-neutral-200 text-xs">
          
          {/* Customer / Billing details */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              Billing Information (Buyer)
            </span>
            <div className="flex flex-col gap-1 text-neutral-700">
              <span className="text-sm font-bold text-neutral-900">{quotation.companyName}</span>
              {quotation.contactName && (
                <span className="font-medium">Attn: {quotation.contactName}</span>
              )}
              <span className="whitespace-pre-line leading-relaxed">{quotation.billingAddress}</span>
              {quotation.gstNumber && (
                <span className="mt-1 font-mono text-[11px]"><strong className="text-neutral-800">GSTIN:</strong> {quotation.gstNumber}</span>
              )}
              {quotation.state && (
                <span><strong className="text-neutral-800">State:</strong> {quotation.state}</span>
              )}
              {quotation.email && (
                <span><strong className="text-neutral-800">Email:</strong> {quotation.email}</span>
              )}
              {quotation.phone && (
                <span><strong className="text-neutral-800">Mobile:</strong> {quotation.phone}</span>
              )}
            </div>
          </div>

          {/* Shipping Information */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              Delivery / Shipping Information
            </span>
            <div className="flex flex-col gap-1 text-neutral-700">
              {quotation.shippingAddress ? (
                <>
                  <span className="text-sm font-bold text-neutral-900">{quotation.companyName}</span>
                  <span className="whitespace-pre-line leading-relaxed">{quotation.shippingAddress}</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-neutral-500 italic">Same as billing address</span>
                  <span className="whitespace-pre-line leading-relaxed text-neutral-500 italic">
                    All deliveries will be routed directly to the corporate office listed on the left side of this agreement.
                  </span>
                </>
              )}
              
              {/* Payment & Sales rep summaries */}
              <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col gap-1">
                <div><strong className="text-neutral-800">Payment Terms:</strong> {quotation.paymentTerms || 'Standard Net 30'}</div>
                <div><strong className="text-neutral-800">Sales Representative:</strong> {quotation.salesExecutiveName}</div>
              </div>
            </div>
          </div>

        </div>

        {/* Product Table */}
        <div className="py-8">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 font-bold border-b border-neutral-200">
                <th className="py-3 px-4 w-12 text-center">S.No</th>
                <th className="py-3 px-4">Product Description</th>
                <th className="py-3 px-4 text-center">HSN Code</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Rate (INR)</th>
                <th className="py-3 px-4 text-right">Discount</th>
                <th className="py-3 px-4 text-center">GST %</th>
                <th className="py-3 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-700">
              {quotation.items.map((item, idx) => {
                const discountText = item.discountValue > 0 
                  ? (item.discountType === 'percentage' ? `${item.discountValue}%` : `₹${item.discountValue}`)
                  : '-';

                return (
                  <tr key={idx} className="hover:bg-neutral-50/20">
                    <td className="py-4 px-4 text-center text-neutral-400 font-medium">{idx + 1}</td>
                    <td className="py-4 px-4 font-medium text-neutral-900">
                      <div>{item.productName}</div>
                      <div className="text-[10px] text-neutral-500 mt-1 leading-relaxed max-w-md">
                        {item.description}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center font-mono text-[10px] text-neutral-400">
                      {item.productId === 1 || item.productId === 2 ? '842199' : item.productId === 3 ? '382490' : '380894'}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-medium">
                      {item.quantity} <span className="text-[10px] text-neutral-400">{item.unit}</span>
                    </td>
                    <td className="py-4 px-4 text-right font-mono">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-amber-700">
                      {discountText}
                    </td>
                    <td className="py-4 px-4 text-center font-mono">
                      {item.gstPercent}%
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-neutral-900 font-mono">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Financial Summary Breakdown Block */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-6 border-t border-neutral-200">
          
          {/* Left side: Amount in words */}
          <div className="md:col-span-7 text-xs text-neutral-600 flex flex-col justify-end">
            <div className="mb-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
              <strong className="text-neutral-500 uppercase text-[9px] tracking-widest block mb-1">
                Amount in Words (INR)
              </strong>
              <span className="font-bold text-neutral-800 leading-relaxed">
                {numberToWords(quotation.grandTotal)}
              </span>
            </div>
            
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              * This is a computer generated quote. Prices are based on standard terms and exclude external unloading charges unless specified.
            </p>
          </div>

          {/* Right side: Calculations */}
          <div className="md:col-span-5 text-xs text-neutral-700 flex flex-col gap-2">
            <div className="flex justify-between">
              <span>Gross Sub Total:</span>
              <span className="font-mono">{formatCurrency(quotation.subTotal)}</span>
            </div>
            {quotation.totalDiscount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Total Discount Applied:</span>
                <span className="font-mono">- {formatCurrency(quotation.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-neutral-100 pt-2 text-neutral-900">
              <span>Taxable Net Amount:</span>
              <span className="font-mono">{formatCurrency(quotation.taxableAmount)}</span>
            </div>

            {/* GST breakdown */}
            {isLocalState ? (
              <>
                <div className="flex justify-between text-neutral-500 pl-4">
                  <span>Central GST (CGST @ 9%):</span>
                  <span className="font-mono">{formatCurrency(cgstAmount)}</span>
                </div>
                <div className="flex justify-between text-neutral-500 pl-4">
                  <span>State GST (SGST @ 9%):</span>
                  <span className="font-mono">{formatCurrency(sgstAmount)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-neutral-500 pl-4">
                <span>Integrated GST (IGST @ 18%):</span>
                <span className="font-mono">{formatCurrency(igstAmount)}</span>
              </div>
            )}

            {/* Additional Charges breakdown */}
            {quotation.additionalCharges.map((charge, idx) => (
              <div key={idx} className="flex justify-between text-neutral-600">
                <span>{charge.name}:</span>
                <span className="font-mono">{formatCurrency(charge.amount)}</span>
              </div>
            ))}

            {quotation.roundOff !== 0 && (
              <div className="flex justify-between text-neutral-400">
                <span>Round Off:</span>
                <span className="font-mono">
                  {quotation.roundOff > 0 ? `+${formatCurrency(quotation.roundOff)}` : `-${formatCurrency(Math.abs(quotation.roundOff))}`}
                </span>
              </div>
            )}

            <div className="border-t-2 border-neutral-800 my-1 pt-3 flex justify-between font-display text-neutral-900 font-extrabold text-base">
              <span>Grand Total:</span>
              <span className="font-mono">{formatCurrency(quotation.grandTotal)}</span>
            </div>
          </div>

        </div>

        {/* Terms & Conditions Contract List */}
        <div className="mt-12 pt-8 border-t border-neutral-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
            Terms & Conditions (Agreed Contract Parameters)
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-[11px] leading-relaxed text-neutral-600">
            {quotation.terms.deliveryPeriod && (
              <div>
                <strong className="text-neutral-800">1. Delivery Period:</strong> {quotation.terms.deliveryPeriod}
              </div>
            )}
            {quotation.terms.paymentTerms && (
              <div>
                <strong className="text-neutral-800">2. Payment Terms:</strong> {quotation.terms.paymentTerms}
              </div>
            )}
            {quotation.terms.freightTerms && (
              <div>
                <strong className="text-neutral-800">3. Freight & Forwarding:</strong> {quotation.terms.freightTerms}
              </div>
            )}
            {quotation.terms.warranty && (
              <div>
                <strong className="text-neutral-800">4. Warranty Period:</strong> {quotation.terms.warranty}
              </div>
            )}
            {quotation.terms.validity && (
              <div>
                <strong className="text-neutral-800">5. Offer Validity:</strong> {quotation.terms.validity}
              </div>
            )}
            {quotation.terms.taxes && (
              <div>
                <strong className="text-neutral-800">6. Taxes & Levies:</strong> {quotation.terms.taxes}
              </div>
            )}
            {quotation.terms.installationScope && (
              <div>
                <strong className="text-neutral-800">7. Installation Scope:</strong> {quotation.terms.installationScope}
              </div>
            )}
            {quotation.terms.exclusions && (
              <div>
                <strong className="text-neutral-800">8. Specific Exclusions:</strong> {quotation.terms.exclusions}
              </div>
            )}
            {quotation.terms.generalTerms && (
              <div className="md:col-span-2 mt-1">
                <strong className="text-neutral-800">9. General Selling Terms:</strong> {quotation.terms.generalTerms}
              </div>
            )}
          </div>
        </div>

        {/* Document Footer: Authorized Signatory block */}
        <div className="grid grid-cols-2 gap-8 mt-16 pt-12 border-t border-dashed border-neutral-200 text-xs text-neutral-500">
          <div>
            <p className="font-bold text-neutral-800 mb-10">Accepted By Client:</p>
            <div className="h-px bg-neutral-300 w-48 mb-2"></div>
            <p>Signature & Seal</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="font-bold text-neutral-800 mb-1">For SP CRM Limited</p>
            <p className="text-[10px] text-neutral-400 mb-8">Authorized Signatory</p>
            <div className="h-px bg-neutral-300 w-48 mb-2"></div>
            <p>Signature & Date</p>
          </div>
        </div>

      </div>
    </div>
  );
}
