import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCircle, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  Eye,
  ArrowUpRight,
  Filter,
  ArrowUpDown,
  Search
} from 'lucide-react';
import { GlassCard } from './ui/shared';
import { getLeads, saveLeads, convertLeadToEnquiry } from '../utils/crmStore';
import { Lead, LeadStatus } from '../data/mockLeads';

export function LeadWidget() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | 'New' | 'Contacted' | 'Qualified' | 'Needs Action'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'value-high' | 'value-low'>('newest');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadData = () => {
    setLeads(getLeads());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('crm-store-update', loadData);
    return () => window.removeEventListener('crm-store-update', loadData);
  }, []);

  const attentionCount = useMemo(() => {
    return leads.filter(l => {
      if (l.status === 'Converted' || l.status === 'Lost') return false;
      const hasTodayFollowup = (l.followUps || []).some(f => f.status === 'Pending');
      return l.status === 'New' || l.status === 'Qualified' || hasTodayFollowup;
    }).length;
  }, [leads]);

  // Filter & Sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let result = leads.filter(l => l.status !== 'Converted' && l.status !== 'Lost');

    // Status filter
    if (statusFilter === 'Needs Action') {
      result = result.filter(l => {
        const hasTodayFollowup = (l.followUps || []).some(f => f.status === 'Pending');
        return l.status === 'New' || l.status === 'Qualified' || hasTodayFollowup;
      });
    } else if (statusFilter !== 'All') {
      result = result.filter(l => l.status === statusFilter);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.companyName.toLowerCase().includes(q) ||
        l.contactPerson.toLowerCase().includes(q) ||
        l.leadNumber.toLowerCase().includes(q) ||
        (l.city && l.city.toLowerCase().includes(q))
      );
    }

    // Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
      if (sortBy === 'oldest') return new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
      if (sortBy === 'value-high') return (b.potentialBusinessValue || 0) - (a.potentialBusinessValue || 0);
      if (sortBy === 'value-low') return (a.potentialBusinessValue || 0) - (b.potentialBusinessValue || 0);
      return 0;
    });
  }, [leads, statusFilter, searchQuery, sortBy]);

  const handleQuickStatusChange = (leadId: number, status: LeadStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = leads.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          status,
          activities: [
            {
              id: Date.now(),
              date: new Date().toISOString(),
              type: 'System' as const,
              description: `Status updated to ${status} from Dashboard Widget`,
              performedBy: 'Current User'
            },
            ...(l.activities || [])
          ]
        };
      }
      return l;
    });
    setLeads(updated);
    saveLeads(updated);
  };

  const handleQuickConvert = (leadId: number, companyName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = convertLeadToEnquiry(leadId);
    if (res) {
      setSuccessToast(`Converted "${companyName}" to Enquiry ${res.enquiry.enquiryNumber}`);
      loadData();
      setTimeout(() => setSuccessToast(null), 5000);
    }
  };

  const navigateToLeadsPage = (leadId?: number) => {
    if (leadId) {
      localStorage.setItem('crm_goto_lead', leadId.toString());
    }
    window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
      detail: { workspace: 'Home', page: 'Leads' }
    }));
  };

  const navigateToEnquiryPage = () => {
    window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
      detail: { workspace: 'Home', page: 'Enquiry' }
    }));
  };

  return (
    <GlassCard intensity="light" className="p-4 md:p-5 w-full h-full flex flex-col gap-3.5 border border-neutral-200/80 shadow-sm relative overflow-hidden">
      {/* Widget Header - Standard Dashboard Pattern */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-200/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/80 text-amber-800 border border-amber-200/80 flex items-center justify-center shrink-0 shadow-2xs">
            <TrendingUp size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold text-[#1a1a1a] truncate">Lead Management</h2>
              {attentionCount > 0 && (
                <span className="text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                  {attentionCount}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 font-medium truncate">Track inquiries, schedule follow-ups & convert to Enquiries</p>
          </div>
        </div>

        {/* Action Buttons: Filter, Sort, Open */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={() => {
              setShowFilterPanel(!showFilterPanel);
              if (showSortPanel) setShowSortPanel(false);
            }}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all shadow-2xs ${
              showFilterPanel || statusFilter !== 'All' || searchQuery 
                ? 'bg-neutral-900 border-neutral-900 text-white' 
                : 'bg-white border-neutral-200/80 text-neutral-600 hover:bg-neutral-100'
            }`}
            title="Filter Leads"
          >
            <Filter size={14} />
          </button>

          <button 
            onClick={() => {
              setShowSortPanel(!showSortPanel);
              if (showFilterPanel) setShowFilterPanel(false);
            }}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all shadow-2xs ${
              showSortPanel || sortBy !== 'newest'
                ? 'bg-neutral-900 border-neutral-900 text-white' 
                : 'bg-white border-neutral-200/80 text-neutral-600 hover:bg-neutral-100'
            }`}
            title="Sort Leads"
          >
            <ArrowUpDown size={14} />
          </button>

          <button 
            onClick={() => navigateToLeadsPage()}
            className="w-8 h-8 rounded-full bg-white border border-neutral-200/80 flex items-center justify-center text-neutral-700 hover:text-black hover:bg-neutral-100 transition-all shadow-2xs"
            title="Go to Leads Directory"
          >
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {showFilterPanel && (
        <div className="p-3 bg-neutral-50/90 border border-neutral-200/80 rounded-xl flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text"
              placeholder="Filter by company, lead #, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-medium text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-1 shrink-0">Status:</span>
            {(['All', 'Needs Action', 'New', 'Contacted', 'Qualified'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                  statusFilter === status 
                    ? 'bg-neutral-900 text-white shadow-2xs' 
                    : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Sort Panel */}
      {showSortPanel && (
        <div className="p-3 bg-neutral-50/90 border border-neutral-200/80 rounded-xl flex items-center justify-between gap-2 animate-in slide-in-from-top-2 duration-150 shrink-0">
          <span className="text-xs font-bold text-neutral-700">Sort By:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'newest', label: 'Newest First' },
              { id: 'oldest', label: 'Oldest First' },
              { id: 'value-high', label: 'Highest Value' },
              { id: 'value-low', label: 'Lowest Value' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setSortBy(item.id as any)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  sortBy === item.id 
                    ? 'bg-neutral-900 text-white' 
                    : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-800 font-medium flex items-center justify-between gap-2 animate-in fade-in duration-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span className="truncate">{successToast}</span>
          </div>
          <button 
            onClick={navigateToEnquiryPage}
            className="text-[11px] font-bold text-emerald-700 hover:underline shrink-0 flex items-center gap-0.5"
          >
            View <ArrowUpRight size={11} />
          </button>
        </div>
      )}

      {/* Lead Cards List with Vertical Scroll fitting container */}
      <div className="flex-1 min-h-[300px] max-h-[520px] overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
        {filteredAndSortedLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-neutral-200 rounded-xl bg-white/40 my-auto">
            <p className="text-neutral-500 font-medium text-xs">No leads found with selected filters.</p>
            <button 
              onClick={() => { setStatusFilter('All'); setSearchQuery(''); setSortBy('newest'); }}
              className="mt-2 text-xs font-bold text-blue-600 hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredAndSortedLeads.map((lead) => {
            const pendingFollowup = (lead.followUps || []).find(f => f.status === 'Pending');
            const isQualified = lead.status === 'Qualified';
            const isNew = lead.status === 'New';

            return (
              <div
                key={lead.id}
                onClick={() => navigateToLeadsPage(lead.id)}
                className="bg-white border border-neutral-200/80 hover:border-neutral-400 rounded-xl p-3 shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col gap-2 group relative"
              >
                {/* Top Row: ID & Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-md border border-neutral-200">
                    {lead.leadNumber}
                  </span>

                  {isQualified ? (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <Sparkles size={10} /> Ready to Convert
                    </span>
                  ) : pendingFollowup ? (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                      <Calendar size={10} /> Follow-up Scheduled
                    </span>
                  ) : isNew ? (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                      <Clock size={10} /> Action Needed
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full border border-neutral-200">
                      {lead.status}
                    </span>
                  )}
                </div>

                {/* Company Name & Contact Person */}
                <div>
                  <h3 className="font-bold text-sm text-[#1a1a1a] group-hover:text-blue-600 transition-colors line-clamp-1">
                    {lead.companyName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                    <span className="flex items-center gap-1 truncate">
                      <UserCircle size={12} className="shrink-0 text-neutral-400" />
                      {lead.contactPerson}
                    </span>
                    <span>•</span>
                    <span className="truncate">{lead.city || lead.industry || 'Inquiry'}</span>
                  </div>
                </div>

                {/* Requirement Note if exists */}
                {lead.requirementSummary && (
                  <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200/60 text-xs text-neutral-600 line-clamp-2 italic">
                    "{lead.requirementSummary}"
                  </div>
                )}

                {/* Bottom Row: Value & Quick Action */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-100 mt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-neutral-900">
                      ₹{(lead.potentialBusinessValue || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Contextual Action Button */}
                  <div className="flex items-center gap-1.5">
                    {isQualified ? (
                      <button
                        onClick={(e) => handleQuickConvert(lead.id, lead.companyName, e)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                        title="Convert directly to Enquiry"
                      >
                        <CheckCircle2 size={11} />
                        <span>Convert</span>
                      </button>
                    ) : isNew ? (
                      <button
                        onClick={(e) => handleQuickStatusChange(lead.id, 'Contacted', e)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                        title="Mark Contacted"
                      >
                        <Phone size={11} />
                        <span>Contacted</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleQuickStatusChange(lead.id, 'Qualified', e)}
                        className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-bold transition-all"
                        title="Mark Qualified"
                      >
                        <span>Qualify</span>
                      </button>
                    )}

                    <span className="w-6 h-6 rounded-md bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200 flex items-center justify-center transition-colors">
                      <Eye size={12} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}
