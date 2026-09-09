import { ArrowLeft, Building2, MapPin, User, Save } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';

export function NewBusinessPartner({ onBack, onSave }: { onBack: () => void, onSave: () => void }) {
  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in zoom-in-95 duration-300 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors shadow-sm text-neutral-600"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#1a1a1a]">New Business Partner</h1>
        </div>
        <button 
          onClick={onSave}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#1a1a1a] text-white rounded-full shadow-lg hover:bg-black transition-colors"
        >
          <Save size={18} />
          <span className="font-medium">Save Partner</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 pt-2 pb-10">
        {/* Form Sections */}
        <div className="flex flex-col gap-8">
          
          {/* Section 1 - Basic Information */}
          <GlassCard intensity="light" className="p-6">
            <h3 className="font-semibold text-lg mb-6 flex items-center gap-2 border-b border-neutral-200/50 pb-3">
              <Building2 size={18} className="text-neutral-500" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Business Partner Name *</label>
                <input type="text" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Enter company name" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Business Type *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-medium text-neutral-700">Customer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-medium text-neutral-700">Supplier</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-medium text-neutral-700">Both</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Industry *</label>
                <select className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                  <option value="">Select industry...</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="it">IT Services</option>
                  <option value="retail">Retail</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Company Website</label>
                <input type="url" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="https://" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Company Email</label>
                <input type="email" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="info@company.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone</label>
                <input type="tel" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="+1..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Mobile</label>
                <input type="tel" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">GST Number</label>
                <input type="text" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">PAN Number</label>
                <input type="text" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
            </div>
          </GlassCard>

          {/* Section 3 - Address */}
          <GlassCard intensity="light" className="p-6">
            <h3 className="font-semibold text-lg mb-6 flex items-center gap-2 border-b border-neutral-200/50 pb-3">
              <MapPin size={18} className="text-neutral-500" />
              Address Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Billing Address</label>
                <textarea rows={2} className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"></textarea>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Shipping Address</label>
                <textarea rows={2} className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">City</label>
                <input type="text" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">District</label>
                <input type="text" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">State</label>
                <input type="text" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Country</label>
                <input type="text" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">PIN Code</label>
                <input type="text" className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
            </div>
            <div className="mt-4 p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-500 text-center">
              Google Maps integration will be available here later.
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
