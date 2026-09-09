import React from 'react';
import { Search, Plus, Filter, Package, AlertCircle, TrendingUp, IndianRupee } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';
import { MOCK_PRODUCTS, MOCK_PARTNERS } from '../../data/mockData';

export function ProductsList({ onNewProduct, onViewDetail }: { onNewProduct: () => void, onViewDetail: (id: number) => void }) {
  
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
      
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            placeholder="Search products by name, code, category..." 
            className="w-full bg-white/50 backdrop-blur-sm border border-neutral-200/50 rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-sm shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/50 backdrop-blur-sm border border-neutral-200/50 rounded-full text-sm font-medium text-neutral-700 hover:bg-white/80 transition-all shadow-sm">
            <Filter size={16} /> Filters
          </button>
          <button 
            onClick={onNewProduct}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a1a1a] text-white rounded-full text-sm font-medium hover:bg-black transition-all shadow-md hover:shadow-lg"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Total Products</p>
            <h4 className="text-xl font-bold text-[#1a1a1a]">{MOCK_PRODUCTS.length}</h4>
          </div>
        </GlassCard>
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Active Products</p>
            <h4 className="text-xl font-bold text-[#1a1a1a]">{MOCK_PRODUCTS.filter(p => p.status === 'Active').length}</h4>
          </div>
        </GlassCard>
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Needs Sourcing</p>
            <h4 className="text-xl font-bold text-[#1a1a1a]">{MOCK_PRODUCTS.filter(p => (p.vendors || []).length === 0).length}</h4>
          </div>
        </GlassCard>
      </div>

      {/* List */}
      <GlassCard intensity="light" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-neutral-200/50">
                <th className="px-6 py-4 font-semibold text-neutral-500">Product Info</th>
                <th className="px-6 py-4 font-semibold text-neutral-500">Category</th>
                <th className="px-6 py-4 font-semibold text-neutral-500">Preferred Vendor</th>
                <th className="px-6 py-4 font-semibold text-neutral-500">Latest Purchase Price</th>
                <th className="px-6 py-4 font-semibold text-neutral-500">Est. Landed Cost</th>
                <th className="px-6 py-4 font-semibold text-neutral-500">Std. Selling Price</th>
                <th className="px-6 py-4 font-semibold text-neutral-500">Vendors</th>
                <th className="px-6 py-4 font-semibold text-neutral-500">Status</th>
                <th className="px-6 py-4 font-semibold text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {MOCK_PRODUCTS.map(product => {
                const vendorsList = product.vendors || [];
                const preferredVendor = vendorsList.find(v => v.isPreferred) || vendorsList[0];
                const vendorObj = preferredVendor ? MOCK_PARTNERS.find(p => p.id === preferredVendor.vendorId) : null;
                
                let totalAddlCost = 0;
                if (preferredVendor) {
                   (preferredVendor.additionalCosts || []).forEach(c => {
                     if (c.type === 'Fixed') totalAddlCost += c.amount;
                     else totalAddlCost += (preferredVendor.purchasePrice * c.amount) / 100;
                   });
                }
                const landedCost = preferredVendor ? preferredVendor.purchasePrice + totalAddlCost : 0;

                return (
                  <tr key={product.id} className="hover:bg-neutral-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#1a1a1a] group-hover:text-blue-600 transition-colors cursor-pointer" onClick={() => onViewDetail(product.id)}>{product.name}</span>
                        <span className="text-xs text-neutral-500">{product.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-600 font-medium">
                      {product.category}
                    </td>
                    <td className="px-6 py-4 text-neutral-600">
                      {vendorObj ? vendorObj.name : '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#1a1a1a]">
                      {preferredVendor ? `₹${preferredVendor.purchasePrice.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-blue-700">
                      {landedCost ? `₹${landedCost.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-green-700">
                      {product.standardSellingPrice ? `₹${product.standardSellingPrice.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-neutral-600 text-center">
                      <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 rounded-md text-xs font-bold">
                        {vendorsList.length}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getStatusColor(product.status)}`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => onViewDetail(product.id)}
                        className="px-3 py-1.5 border border-neutral-200 bg-white rounded-lg text-xs font-semibold hover:bg-neutral-50 transition-colors shadow-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

    </div>
  );
}
