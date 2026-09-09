import React, { useState } from 'react';
import { Search, Plus, Filter, FileText, Calendar, Building2, User, AlertCircle, ArrowRight, X } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';
import { MOCK_PARTNERS } from '../../data/mockData';
import { getEnquiries } from '../../utils/crmStore';

export function EnquiriesList({ onView, onNew }: { onView: (id: number) => void, onNew: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [selectedStage, setSelectedStage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('crm_enquiry_stage_filter');
      if (saved) {
        localStorage.removeItem('crm_enquiry_stage_filter');
        return saved;
      }
    }
    return 'All';
  });
  const [showFilters, setShowFilters] = useState(false);

  const enquiries = getEnquiries();

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'Critical': return 'text-red-700 bg-red-100 border border-red-200';
      case 'High': return 'text-orange-700 bg-orange-100 border border-orange-200';
      case 'Medium': return 'text-blue-700 bg-blue-100 border border-blue-200';
      case 'Low': return 'text-green-700 bg-green-100 border border-green-200';
      default: return 'text-neutral-600 bg-neutral-100';
    }
  };

  const getStageColor = (stage: string) => {
    switch(stage) {
      case 'New': return 'text-blue-600 bg-blue-50';
      case 'In Progress': return 'text-purple-600 bg-purple-50';
      case 'Quotation': return 'text-indigo-600 bg-indigo-50';
      case 'Followup': return 'text-amber-600 bg-amber-50';
      case 'Negotiation': return 'text-orange-600 bg-orange-50';
      case 'Won': return 'text-green-600 bg-green-50';
      case 'Lost': return 'text-rose-600 bg-rose-50';
      case 'Sales Order': return 'text-emerald-600 bg-emerald-50';
      default: return 'text-neutral-600 bg-neutral-50';
    }
  };

  // Filter logic
  const filteredEnquiries = enquiries.filter(enquiry => {
    const company = MOCK_PARTNERS.find(p => p.id === enquiry.companyId);
    
    const matchesSearch = 
      enquiry.enquiryNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enquiry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (enquiry.assignedTo || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority = selectedPriority === 'All' || enquiry.priority === selectedPriority;
    const matchesStage = selectedStage === 'All' || 
      enquiry.stage === selectedStage ||
      (selectedStage === 'Quotation' && enquiry.stage === 'Followup') ||
      (selectedStage === 'Won' && enquiry.stage === 'Sales Order');

    return matchesSearch && matchesPriority && matchesStage;
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a1a]">Customer Enquiries</h2>
          <p className="text-sm text-neutral-500">Track and manage chemical & equipment enquiries</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="text" 
              placeholder="Search enquiries by number, company, title or owner..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors shadow-sm ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}
            >
              <Filter size={16} />
              Filters
              {(selectedPriority !== 'All' || selectedStage !== 'All') && (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              )}
            </button>
            <button 
              onClick={onNew}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] text-white rounded-xl text-sm font-medium hover:bg-black transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={16} />
              New Enquiry
            </button>
          </div>
        </div>

        {/* Dynamic Expandable Filters Panel */}
        {showFilters && (
          <GlassCard intensity="light" className="p-4 flex flex-wrap gap-6 items-center border border-neutral-200/50 bg-neutral-50/50 rounded-xl">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Priority</span>
              <div className="flex items-center gap-2">
                {['All', 'Critical', 'High', 'Medium', 'Low'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPriority(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${selectedPriority === p ? 'bg-[#1a1a1a] text-white border-transparent' : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Stage</span>
              <div className="flex items-center gap-2">
                {['All', 'New', 'In Progress', 'Quotation', 'Followup', 'Won'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedStage(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${selectedStage === s ? 'bg-[#1a1a1a] text-white border-transparent' : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {(selectedPriority !== 'All' || selectedStage !== 'All') && (
              <button 
                onClick={() => {
                  setSelectedPriority('All');
                  setSelectedStage('All');
                }}
                className="mt-5 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors flex items-center gap-1"
              >
                Clear all filters
              </button>
            )}
          </GlassCard>
        )}
      </div>

      {filteredEnquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-white/40 border border-neutral-200/50 rounded-2xl">
          <FileText size={48} className="text-neutral-300 mb-3" />
          <p className="text-neutral-500 font-medium text-sm">No enquiries found matching your criteria.</p>
          <p className="text-neutral-400 text-xs mt-1">Try resetting filters or changing your search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredEnquiries.map(enquiry => {
            const company = MOCK_PARTNERS.find(p => p.id === enquiry.companyId);
            const contact = company?.contacts?.find(c => c.id === enquiry.contactId);
            
            return (
              <div key={enquiry.id} className="h-full flex flex-col cursor-pointer" onClick={() => onView(enquiry.id)}>
                <GlassCard intensity="light" className="p-0 overflow-hidden flex flex-col h-full group hover:border-blue-200/80 transition-all">
                  <div className="p-5 border-b border-neutral-100 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-[#1a1a1a] text-base group-hover:text-blue-600 transition-colors">{enquiry.enquiryNumber}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-0.5">
                            <Calendar size={12} />
                            {enquiry.date}
                          </div>
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${getStageColor(enquiry.stage)}`}>
                        {enquiry.stage}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <h4 className="font-semibold text-neutral-800 text-sm line-clamp-1">{enquiry.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>Assigned to:</span>
                        <span className="font-semibold text-neutral-700">{enquiry.assignedTo || 'Unassigned'}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-sm text-neutral-700">
                        <Building2 size={16} className="text-neutral-400 shrink-0" />
                        <span className="font-medium truncate">{company?.name || 'Unknown Company'}</span>
                      </div>
                      {contact && (
                        <div className="flex items-center gap-2 text-sm text-neutral-600 pl-[26px]">
                          <User size={14} className="text-neutral-400 shrink-0" />
                          <span className="truncate">{contact.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 bg-neutral-50/50 flex-1 flex flex-col justify-between gap-4">
                    <div className="text-sm text-neutral-600">
                      <span className="font-medium text-neutral-800">{enquiry.items.length}</span> {enquiry.items.length === 1 ? 'Product' : 'Products'} Requested
                    </div>
                    
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                        <AlertCircle size={14} />
                        Priority:
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getSeverityColor(enquiry.priority)}`}>
                          {enquiry.priority}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-400 group-hover:text-blue-600 group-hover:border-blue-200 group-hover:bg-blue-50 transition-all">
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
