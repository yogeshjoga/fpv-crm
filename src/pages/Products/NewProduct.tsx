import React from 'react';
import { ArrowLeft, Save, Package, Hash, Tag, Percent, FileText, Activity } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';

export function NewProduct({ onBack, onSave }: { onBack: () => void, onSave: () => void }) {
  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in zoom-in-95 duration-300">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/50 border border-neutral-200/50 hover:bg-white flex items-center justify-center text-neutral-600 transition-all shadow-sm shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-[#1a1a1a]">Create New Product</h2>
            <p className="text-sm text-neutral-500">Fill in the basic product details.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onBack} className="px-5 py-2.5 bg-white border border-neutral-200 rounded-full text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm">
            Cancel
          </button>
          <button onClick={onSave} className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1a1a] text-white rounded-full text-sm font-medium hover:bg-black transition-colors shadow-md hover:shadow-lg">
            <Save size={16} /> Save Product
          </button>
        </div>
      </div>

      <GlassCard intensity="light" className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
              <Package size={14} className="text-neutral-400" /> Product Name *
            </label>
            <input type="text" placeholder="e.g. Industrial Valve 2-inch" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
              <Hash size={14} className="text-neutral-400" /> Product Code *
            </label>
            <input type="text" placeholder="e.g. VAL-001" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm uppercase" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
              <Tag size={14} className="text-neutral-400" /> Category *
            </label>
            <select className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium">
              <option value="">Select Category</option>
              <option value="Filter Cartridges">Filter Cartridges</option>
              <option value="Filter Bags">Filter Bags</option>
              <option value="Filter Housing">Filter Housing</option>
              <option value="Boiler Chemicals">Boiler Chemicals</option>
              <option value="Cooling Tower Chemicals">Cooling Tower Chemicals</option>
              <option value="RO Chemicals">RO Chemicals</option>
              <option value="Water Treatment Chemicals">Water Treatment Chemicals</option>
              <option value="Process Chemicals">Process Chemicals</option>
              <option value="Water Treatment Equipment">Water Treatment Equipment</option>
              <option value="Accessories">Accessories</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">
              Unit *
            </label>
            <select className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium">
              <option value="Nos">Nos</option>
              <option value="Kg">Kg</option>
              <option value="Ltr">Ltr</option>
              <option value="Meters">Meters</option>
              <option value="Set">Set</option>
              <option value="Box">Box</option>
              <option value="Bag">Bag</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
              <Percent size={14} className="text-neutral-400" /> GST % *
            </label>
            <select className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium">
              <option value="18">18%</option>
              <option value="12">12%</option>
              <option value="5">5%</option>
              <option value="28">28%</option>
              <option value="0">0%</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
              <FileText size={14} className="text-neutral-400" /> Description
            </label>
            <textarea 
              rows={4} 
              placeholder="Add product specifications, details..."
              className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
              <Activity size={14} className="text-neutral-400" /> Status *
            </label>
            <select className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Discontinued">Discontinued</option>
            </select>
          </div>
          
        </div>
      </GlassCard>
    </div>
  );
}
