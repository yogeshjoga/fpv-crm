import { useState, useEffect } from 'react';
import { MoreHorizontal, ArrowUpRight, Filter, ChevronLeft, ChevronRight, ListCollapse, MessageSquare } from 'lucide-react';
import { GlassCard, AvatarPile } from './ui/shared';
import { MOCK_PARTNERS, Enquiry } from '../data/mockData';
import { getEnquiries } from '../utils/crmStore';

export function InteractionHistory() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState<'All' | 'Open' | 'Won' | 'Lost'>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High/Critical' | 'Medium/Low'>('All');

  useEffect(() => {
    setEnquiries(getEnquiries());
    
    const handleUpdate = () => {
      setEnquiries(getEnquiries());
    };
    
    window.addEventListener('crm-store-update', handleUpdate);
    return () => window.removeEventListener('crm-store-update', handleUpdate);
  }, []);

  const handleNavigateToEnquiry = (enquiryId: number) => {
    localStorage.setItem('crm_goto_enquiry', enquiryId.toString());
    
    // Dispatch navigation event
    window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
      detail: { workspace: 'Home', page: 'Enquiry' }
    }));

    // Dispatch update event to force re-evaluation of redirect
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('crm-store-update'));
    }, 50);
  };

  const navigateToAllEnquiries = () => {
    window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
      detail: { workspace: 'Home', page: 'Enquiry' }
    }));
  };

  const getStageStyle = (stage: string) => {
    const s = stage.trim().toLowerCase();
    
    // Default fallback (New / General)
    const defaults = {
      bg: 'bg-gradient-to-br from-white to-blue-50/30 border border-blue-100/50 shadow-sm hover:shadow-md',
      textNum: 'text-neutral-500 font-mono text-[11px]',
      textTitle: 'text-neutral-900 font-bold',
      textDesc: 'text-neutral-500 text-xs',
      textStage: 'text-blue-600',
      textDate: 'text-neutral-400 font-semibold',
      btnClass: 'bg-blue-50 text-blue-600 hover:bg-blue-100'
    };

    if (s === 'new') {
      return {
        bg: 'bg-gradient-to-br from-white to-blue-50/25 border border-blue-100/50 shadow-sm hover:shadow-md',
        textNum: 'text-blue-800/80 font-mono text-[11px]',
        textTitle: 'text-neutral-900 font-bold',
        textDesc: 'text-neutral-500 text-xs',
        textStage: 'text-blue-600',
        textDate: 'text-blue-500/80 font-semibold',
        btnClass: 'bg-blue-50 text-blue-600 hover:bg-blue-100/80'
      };
    }
    if (s === 'in progress') {
      return {
        bg: 'bg-gradient-to-br from-white to-indigo-50/25 border border-indigo-100/50 shadow-sm hover:shadow-md',
        textNum: 'text-indigo-800/80 font-mono text-[11px]',
        textTitle: 'text-neutral-900 font-bold',
        textDesc: 'text-neutral-500 text-xs',
        textStage: 'text-indigo-600',
        textDate: 'text-indigo-500/80 font-semibold',
        btnClass: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100/80'
      };
    }
    if (s === 'quotation' || s === 'followup') {
      return {
        bg: 'bg-gradient-to-br from-white to-amber-50/20 border border-amber-200/40 shadow-sm hover:shadow-md',
        textNum: 'text-amber-800/80 font-mono text-[11px]',
        textTitle: 'text-neutral-900 font-bold',
        textDesc: 'text-neutral-500 text-xs',
        textStage: 'text-amber-600',
        textDate: 'text-amber-600/80 font-semibold',
        btnClass: 'bg-amber-50 text-amber-600 hover:bg-amber-100/80'
      };
    }
    if (s === 'negotiation') {
      return {
        bg: 'bg-gradient-to-br from-white to-rose-50/25 border border-rose-100/50 shadow-sm hover:shadow-md',
        textNum: 'text-rose-800/80 font-mono text-[11px]',
        textTitle: 'text-neutral-900 font-bold',
        textDesc: 'text-neutral-500 text-xs',
        textStage: 'text-rose-600',
        textDate: 'text-rose-500/80 font-semibold',
        btnClass: 'bg-rose-50 text-rose-600 hover:bg-rose-100/80'
      };
    }
    if (s === 'won' || s === 'sales order') {
      return {
        bg: 'bg-gradient-to-br from-white to-emerald-50/25 border border-emerald-100/50 shadow-sm hover:shadow-md',
        textNum: 'text-emerald-800/80 font-mono text-[11px]',
        textTitle: 'text-neutral-900 font-bold',
        textDesc: 'text-neutral-500 text-xs',
        textStage: 'text-emerald-600',
        textDate: 'text-emerald-500/80 font-semibold',
        btnClass: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100/80'
      };
    }
    if (s === 'lost') {
      return {
        bg: 'bg-gradient-to-br from-white to-neutral-50/40 border border-neutral-200/40 shadow-sm hover:shadow-md',
        textNum: 'text-neutral-500 font-mono text-[11px]',
        textTitle: 'text-neutral-600 font-bold',
        textDesc: 'text-neutral-400 text-xs',
        textStage: 'text-neutral-500',
        textDate: 'text-neutral-400 font-semibold',
        btnClass: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
      };
    }

    return defaults;
  };

  // Apply filters
  const filteredEnquiries = enquiries.filter(e => {
    if (stageFilter !== 'All') {
      if (stageFilter === 'Open' && (e.status === 'Closed' || e.stage === 'Won' || e.stage === 'Lost')) return false;
      if (stageFilter === 'Won' && e.stage !== 'Won') return false;
      if (stageFilter === 'Lost' && e.stage !== 'Lost') return false;
    }
    if (priorityFilter !== 'All') {
      if (priorityFilter === 'High/Critical' && e.priority !== 'High' && e.priority !== 'Critical') return false;
      if (priorityFilter === 'Medium/Low' && e.priority !== 'Medium' && e.priority !== 'Low') return false;
    }
    return true;
  });

  return (
    <GlassCard className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100/80 text-blue-800 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-2xs">
            <MessageSquare size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-[#1a1a1a] truncate">Recent Enquiries</h2>
            <p className="text-xs text-neutral-500 font-medium truncate">Swipe or scroll to view active pipelines ({filteredEnquiries.length})</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all shadow-2xs ${
              showFilters 
                ? 'bg-neutral-900 border-neutral-900 text-white' 
                : 'bg-white border-neutral-200/80 text-neutral-600 hover:bg-neutral-100'
            }`}
            title="Filter Enquiries"
          >
            <Filter size={14} />
          </button>
          
          <button 
            onClick={navigateToAllEnquiries}
            className="w-8 h-8 rounded-full bg-white border border-neutral-200/80 flex items-center justify-center text-neutral-700 hover:text-black hover:bg-neutral-100 transition-all shadow-2xs"
            title="View Full List"
          >
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      {/* Expandable fully-workable filters */}
      {showFilters && (
        <div className="mb-5 p-4 bg-neutral-50/80 border border-neutral-200/50 rounded-2xl flex flex-wrap gap-4 items-center animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Pipeline Stage</span>
            <div className="flex bg-neutral-200/60 p-0.5 rounded-lg border border-neutral-200/40">
              {(['All', 'Open', 'Won', 'Lost'] as const).map(stage => (
                <button
                  key={stage}
                  onClick={() => setStageFilter(stage)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    stageFilter === stage 
                      ? 'bg-white text-neutral-900 shadow-sm' 
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Priority</span>
            <div className="flex bg-neutral-200/60 p-0.5 rounded-lg border border-neutral-200/40">
              {(['All', 'High/Critical', 'Medium/Low'] as const).map(prio => (
                <button
                  key={prio}
                  onClick={() => setPriorityFilter(prio)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    priorityFilter === prio 
                      ? 'bg-white text-neutral-900 shadow-sm' 
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {prio}
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={() => {
              setStageFilter('All');
              setPriorityFilter('All');
              setShowFilters(false);
            }}
            className="ml-auto text-xs font-semibold text-neutral-500 hover:text-neutral-800 px-3 py-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Horizontal scrolling wrapper */}
      {filteredEnquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-neutral-200 rounded-[2rem] bg-white/20">
          <p className="text-neutral-400 font-medium text-sm">No enquiries match the selected filters.</p>
          <button 
            onClick={() => { setStageFilter('All'); setPriorityFilter('All'); }}
            className="mt-3 text-xs font-bold text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-5 pb-3 pt-1 scroll-smooth snap-x snap-mandatory [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-neutral-200/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-track]:bg-transparent">
          {filteredEnquiries.map((enquiry) => {
            const company = MOCK_PARTNERS.find(p => p.id === enquiry.companyId);
            const style = getStageStyle(enquiry.stage);
            
            return (
              <div 
                key={enquiry.id} 
                onClick={() => handleNavigateToEnquiry(enquiry.id)}
                className={`relative p-5 rounded-[2rem] flex flex-col justify-between h-[180px] w-[280px] md:w-[320px] shrink-0 snap-start transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer ${style.bg}`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${style.textDate}`}>
                    {new Date(enquiry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    {enquiry.priority === 'Critical' && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded-full">
                        Crit
                      </span>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateToEnquiry(enquiry.id);
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${style.btnClass}`}
                    >
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-2 mb-auto pr-2">
                  <h3 className={`font-semibold text-sm leading-tight truncate ${style.textNum}`}>
                    {enquiry.enquiryNumber}
                  </h3>
                  <p className={`text-xs font-bold truncate mt-1 ${style.textTitle}`}>
                    {company?.name || 'Unknown'}
                  </p>
                  <p className={`text-[11px] truncate mt-0.5 line-clamp-1 opacity-80 ${style.textDesc}`}>
                    {enquiry.title}
                  </p>
                </div>

                <div className="flex items-end justify-between mt-4 border-t border-black/[0.04] pt-2">
                  <span className={`font-display font-extrabold text-xs uppercase tracking-wider ${style.textStage}`}>
                    {enquiry.stage}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold ${style.textDesc}`}>
                      {enquiry.items?.length || 0} item{(enquiry.items?.length || 0) !== 1 ? 's' : ''}
                    </span>
                    <AvatarPile count={enquiry.items?.length || 1} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
