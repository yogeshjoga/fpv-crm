import { Search, Plus, Filter, MoreHorizontal, Building2, MapPin, Phone } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';
import { MOCK_PARTNERS } from '../../data/mockData';

export function BusinessPartnersList({ onView, onNew }: { onView: (id: number) => void, onNew: () => void }) {
  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1a1a1a]">Business Partners</h1>
          <p className="text-neutral-500 mt-1">Manage your customers, suppliers, and business contacts.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-neutral-200 shadow-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
            <Filter size={18} />
            <span className="font-medium">Filter</span>
          </button>
          <button 
            onClick={onNew}
            className="flex items-center gap-2 px-5 py-2 bg-[#1a1a1a] text-white rounded-full shadow-lg hover:bg-black transition-colors"
          >
            <Plus size={18} />
            <span className="font-medium">Add New</span>
          </button>
        </div>
      </div>

      <GlassCard intensity="light" className="p-4 md:p-6 w-full">
        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search partners by name, industry, or location..." 
            className="w-full bg-white/50 border border-white/60 rounded-full py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200/50">
                <th className="pb-4 px-4 font-semibold text-neutral-500 text-sm">Partner Name</th>
                <th className="pb-4 px-4 font-semibold text-neutral-500 text-sm hidden md:table-cell">Type</th>
                <th className="pb-4 px-4 font-semibold text-neutral-500 text-sm hidden lg:table-cell">Industry</th>
                <th className="pb-4 px-4 font-semibold text-neutral-500 text-sm hidden sm:table-cell">Location</th>
                <th className="pb-4 px-4 font-semibold text-neutral-500 text-sm hidden xl:table-cell">Phone</th>
                <th className="pb-4 px-4 font-semibold text-neutral-500 text-sm">Status</th>
                <th className="pb-4 px-4 font-semibold text-neutral-500 text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PARTNERS.map(partner => (
                <tr 
                  key={partner.id} 
                  className="border-b border-neutral-200/50 hover:bg-white/40 transition-colors cursor-pointer group"
                  onClick={() => onView(partner.id)}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 border border-neutral-200">
                        <Building2 size={18} />
                      </div>
                      <span className="font-semibold text-[#1a1a1a]">{partner.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 hidden md:table-cell">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                      {partner.type}
                    </span>
                  </td>
                  <td className="py-4 px-4 hidden lg:table-cell text-neutral-600">{partner.industry}</td>
                  <td className="py-4 px-4 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5 text-neutral-600">
                      <MapPin size={14} />
                      <span>{partner.city}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 hidden xl:table-cell">
                    <div className="flex items-center gap-1.5 text-neutral-600">
                      <Phone size={14} />
                      <span>{partner.phone}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      partner.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                    }`}>
                      {partner.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); }}
                      className="p-2 rounded-full hover:bg-neutral-200 text-neutral-500 transition-colors inline-flex opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
