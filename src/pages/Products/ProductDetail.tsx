import React, { useState } from 'react';
import { ArrowLeft, Package, Hash, MapPin, Building2, User, Calendar, Activity, CheckCircle2, TrendingUp, IndianRupee, Truck, Tag, Percent, FileText, Anchor } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';
import { MOCK_PRODUCTS, MOCK_PARTNERS } from '../../data/mockData';

const TABS = [
  'Overview',
  'Vendors',
  'Additional Costs',
  'Price History',
  'Documents',
  'Related Enquiries',
  'Related Quotations',
  'Related Orders',
  'Analytics'
];

export function ProductDetail({ productId, onBack }: { productId: number, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const product = MOCK_PRODUCTS.find(p => p.id === productId);

  if (!product) return null;

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Active': return 'bg-green-100 text-green-700';
      case 'Inactive': return 'bg-neutral-100 text-neutral-600';
      case 'Discontinued': return 'bg-red-100 text-red-700';
      case 'Seasonal': return 'bg-orange-100 text-orange-700';
      case 'Special Order': return 'bg-purple-100 text-purple-700';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/50 border border-neutral-200/50 hover:bg-white flex items-center justify-center text-neutral-600 transition-all shadow-sm shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-[#1a1a1a]">{product.name}</h2>
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getStatusColor(product.status)}`}>
              {product.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-500 font-medium">
            <span className="flex items-center gap-1.5"><Hash size={14}/> {product.code}</span>
            <span className="flex items-center gap-1.5"><Tag size={14}/> {product.category}</span>
            <span className="flex items-center gap-1.5"><Anchor size={14}/> {product.brand}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center overflow-x-auto hide-scrollbar gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === tab 
                ? 'bg-[#1a1a1a] text-white shadow-md' 
                : 'bg-white/50 text-neutral-600 hover:bg-white hover:shadow-sm'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <GlassCard intensity="light" className="p-6">
              <h3 className="text-lg font-semibold text-[#1a1a1a] mb-6 flex items-center gap-2">
                <FileText size={18} className="text-blue-500" /> Basic Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-medium text-neutral-500 mb-1">Unit</p>
                  <p className="font-semibold text-[#1a1a1a]">{product.unit}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 mb-1">HSN Code</p>
                  <p className="font-semibold text-[#1a1a1a]">{product.hsnCode}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-500 mb-1">GST</p>
                  <p className="font-semibold text-[#1a1a1a]">{product.gst}%</p>
                </div>
                <div className="col-span-2 md:col-span-3">
                  <p className="text-sm font-medium text-neutral-500 mb-1">Description</p>
                  <p className="font-medium text-neutral-800">{product.description}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard intensity="light" className="p-6">
              <h3 className="text-lg font-semibold text-[#1a1a1a] mb-6 flex items-center gap-2">
                <IndianRupee size={18} className="text-green-500" /> Sales Pricing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-green-100 bg-green-50/30 rounded-xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                    <IndianRupee size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Standard Selling Price</p>
                    <p className="text-xl font-bold text-[#1a1a1a]">₹{product.standardSellingPrice?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
                <div className="p-4 border border-orange-100 bg-orange-50/30 rounded-xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <IndianRupee size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1">Minimum Selling Price</p>
                    <p className="text-xl font-bold text-[#1a1a1a]">₹{product.minimumSellingPrice?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="flex flex-col gap-6">
             <GlassCard intensity="light" className="p-6">
               <h3 className="text-sm font-semibold text-[#1a1a1a] mb-4 uppercase tracking-wider">Quick Stats</h3>
               <div className="flex flex-col gap-4">
                 <div className="flex items-center justify-between p-3 bg-white border border-neutral-100 rounded-lg">
                   <div className="flex items-center gap-3">
                     <Building2 size={16} className="text-blue-500" />
                     <span className="text-sm font-medium text-neutral-600">Total Vendors</span>
                   </div>
                   <span className="font-bold text-[#1a1a1a]">{product.vendors.length}</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-white border border-neutral-100 rounded-lg">
                   <div className="flex items-center gap-3">
                     <Calendar size={16} className="text-blue-500" />
                     <span className="text-sm font-medium text-neutral-600">Last Updated</span>
                   </div>
                   <span className="font-bold text-[#1a1a1a]">{new Date(product.lastUpdated).toLocaleDateString()}</span>
                 </div>
               </div>
             </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'Vendors' && (
        <div className="flex flex-col gap-6">
           <GlassCard intensity="light" className="p-0 overflow-hidden">
             <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-white/50">
               <h3 className="font-semibold text-[#1a1a1a]">Associated Vendors</h3>
               <button className="px-3 py-1.5 bg-[#1a1a1a] text-white rounded-md text-xs font-semibold">Add Vendor</button>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-neutral-50/50 border-b border-neutral-200/50">
                      <th className="px-6 py-4 font-semibold text-neutral-500">Vendor Name</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Vendor Product Code</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Purchase Price</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">MOQ</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Lead Time</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Valid Till</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {product.vendors.map(vendor => {
                      const bp = MOCK_PARTNERS.find(p => p.id === vendor.vendorId);
                      return (
                        <tr key={vendor.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#1a1a1a]">{bp?.name}</span>
                              {vendor.isPreferred && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">Preferred</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-neutral-600">{vendor.vendorProductCode}</td>
                          <td className="px-6 py-4 font-semibold text-[#1a1a1a]">{vendor.currency} {vendor.purchasePrice.toLocaleString()} / {vendor.unit}</td>
                          <td className="px-6 py-4 text-neutral-600">{vendor.moq} {vendor.unit}</td>
                          <td className="px-6 py-4 text-neutral-600">{vendor.leadTime}</td>
                          <td className="px-6 py-4 text-neutral-600">{new Date(vendor.priceValidTill).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${vendor.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>{vendor.status}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
               </table>
             </div>
           </GlassCard>
        </div>
      )}

      {activeTab === 'Additional Costs' && (
        <div className="flex flex-col gap-6">
           {product.vendors.map(vendor => {
             const bp = MOCK_PARTNERS.find(p => p.id === vendor.vendorId);
             
             let totalAddlCost = 0;
             vendor.additionalCosts.forEach(c => {
               if (c.type === 'Fixed') totalAddlCost += c.amount;
               else totalAddlCost += (vendor.purchasePrice * c.amount) / 100;
             });
             const landedCost = vendor.purchasePrice + totalAddlCost;

             return (
               <div key={vendor.id}>
                 <GlassCard intensity="light" className="p-0 overflow-hidden">
                   <div className="p-5 border-b border-neutral-100 bg-white/50 flex items-center justify-between">
                   <div>
                     <h3 className="font-semibold text-[#1a1a1a] flex items-center gap-2">{bp?.name}</h3>
                     <p className="text-xs text-neutral-500 mt-1">Purchase Price: {vendor.currency} {vendor.purchasePrice.toLocaleString()}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">Est. Landed Cost</p>
                     <p className="text-lg font-bold text-blue-700">{vendor.currency} {landedCost.toLocaleString()}</p>
                   </div>
                 </div>
                 {vendor.additionalCosts.length > 0 ? (
                   <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead>
                        <tr className="bg-neutral-50/50 border-b border-neutral-200/50">
                          <th className="px-6 py-3 font-semibold text-neutral-500">Cost Head</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500">Type</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500">Amount</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500">Calculated Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {vendor.additionalCosts.map(cost => {
                           const calculated = cost.type === 'Fixed' ? cost.amount : (vendor.purchasePrice * cost.amount) / 100;
                           return (
                            <tr key={cost.id} className="hover:bg-neutral-50/50">
                              <td className="px-6 py-3 font-medium text-[#1a1a1a]">{cost.costHead}</td>
                              <td className="px-6 py-3 text-neutral-600">{cost.type}</td>
                              <td className="px-6 py-3 text-neutral-600">{cost.type === 'Fixed' ? `${vendor.currency} ${cost.amount}` : `${cost.amount}%`}</td>
                              <td className="px-6 py-3 font-semibold text-orange-600">+{vendor.currency} {calculated.toLocaleString()}</td>
                            </tr>
                           )
                        })}
                      </tbody>
                   </table>
                 ) : (
                   <div className="p-6 text-center text-neutral-500 text-sm">No additional costs defined for this vendor.</div>
                 )}
               </GlassCard>
               </div>
             );
           })}
        </div>
      )}

      {activeTab === 'Price History' && (
        <div className="flex flex-col gap-6">
           <GlassCard intensity="light" className="p-0 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-neutral-50/50 border-b border-neutral-200/50">
                      <th className="px-6 py-4 font-semibold text-neutral-500">Vendor</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Date</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Old Price</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">New Price</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Change</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Reason</th>
                      <th className="px-6 py-4 font-semibold text-neutral-500">Updated By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {product.priceHistory.length > 0 ? product.priceHistory.map(history => {
                      const bp = MOCK_PARTNERS.find(p => p.id === history.vendorId);
                      const change = history.newPrice - history.oldPrice;
                      const percent = ((change / history.oldPrice) * 100).toFixed(1);
                      const isUp = change > 0;
                      return (
                        <tr key={history.id} className="hover:bg-neutral-50/50">
                          <td className="px-6 py-4 font-medium text-[#1a1a1a]">{bp?.name}</td>
                          <td className="px-6 py-4 text-neutral-600">{new Date(history.updatedDate).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-neutral-600">₹{history.oldPrice.toLocaleString()}</td>
                          <td className="px-6 py-4 font-semibold text-[#1a1a1a]">₹{history.newPrice.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${isUp ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {isUp ? '+' : ''}{percent}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-neutral-600">{history.reason}</td>
                          <td className="px-6 py-4 text-neutral-600 flex items-center gap-2"><User size={14}/> {history.updatedBy}</td>
                        </tr>
                      )
                    }) : (
                      <tr><td colSpan={7} className="px-6 py-8 text-center text-neutral-500">No price history available.</td></tr>
                    )}
                  </tbody>
               </table>
             </div>
           </GlassCard>
        </div>
      )}
      
      {(activeTab === 'Documents' || activeTab === 'Related Enquiries' || activeTab === 'Related Quotations' || activeTab === 'Related Orders' || activeTab === 'Analytics') && (
        <div className="flex flex-col items-center justify-center p-12 bg-white/30 backdrop-blur-md border border-white/60 rounded-3xl text-center shadow-sm">
          <Activity size={40} className="text-neutral-400 mb-4" />
          <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">{activeTab}</h3>
          <p className="text-neutral-500 text-sm max-w-sm">This module is under development and will be available in the next update.</p>
        </div>
      )}

    </div>
  );
}
