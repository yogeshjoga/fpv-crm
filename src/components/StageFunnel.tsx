import { useState, useEffect } from 'react';
import { Filter, ArrowUpRight, BarChart2 } from 'lucide-react';
import { GlassCard } from './ui/shared';
import { getEnquiries } from '../utils/crmStore';
import { Enquiry } from '../data/mockData';

export function StageFunnel() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [timeframe, setTimeframe] = useState<'All Time' | 'Month'>('All Time');

  const loadData = () => {
    setEnquiries(getEnquiries());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('crm-store-update', loadData);
    return () => window.removeEventListener('crm-store-update', loadData);
  }, []);

  const handleNavigateToEnquiryPage = (stage?: string) => {
    if (stage) {
      localStorage.setItem('crm_enquiry_stage_filter', stage);
    }
    window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
      detail: { workspace: 'Home', page: 'Enquiry' }
    }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('crm-store-update'));
    }, 50);
  };

  // Determine enquiries to include based on timeframe
  const displayedEnquiries = enquiries.filter(enq => {
    if (timeframe === 'All Time') return true;
    
    // For 'Month', filter enquiries that are within the most recent month of the dataset (November 2023 / 11-2023)
    const enqDate = new Date(enq.date);
    return enqDate.getFullYear() === 2023 && enqDate.getMonth() === 10; // November is index 10
  });

  const stageCounts = displayedEnquiries.reduce((acc, enquiry) => {
    acc[enquiry.stage] = (acc[enquiry.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalEnquiries = displayedEnquiries.length;

  return (
    <GlassCard className="p-5 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/80 text-emerald-800 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-2xs">
            <BarChart2 size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-[#1a1a1a] truncate">Enquiry Funnel</h2>
            <p className="text-xs text-neutral-500 font-medium truncate">Pipeline conversion by stage</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={() => handleNavigateToEnquiryPage()}
            className="w-8 h-8 rounded-full bg-white border border-neutral-200/80 flex items-center justify-center text-neutral-700 hover:text-black hover:bg-neutral-100 transition-all shadow-2xs"
            title="Navigate to Pipelines"
          >
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="font-display font-semibold text-2xl tracking-tight text-neutral-900">{totalEnquiries}</div>
          <div className="text-xs text-neutral-500 font-medium">Total Enquiries ({timeframe})</div>
        </div>
        <div className="flex items-center bg-neutral-100 p-1 rounded-full border border-neutral-200/40">
          <button 
            onClick={() => setTimeframe('All Time')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all ${
              timeframe === 'All Time' ? 'bg-white text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            All Time
          </button>
          <button 
            onClick={() => setTimeframe('Month')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              timeframe === 'Month' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
            }`}
            title="Enquiries in Nov 2023"
          >
            Recent Month
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-3 w-full">
        <FunnelBar 
          label="New" 
          amount={stageCounts['New']?.toString() || '0'} 
          width="100%" 
          bgColor="bg-white/60" 
          onClick={() => handleNavigateToEnquiryPage('New')}
        />
        <FunnelBar 
          label="In Progress" 
          amount={(stageCounts['In Progress'] || 0).toString()} 
          width="85%" 
          bgColor="bg-white/40" 
          align="end"
          onClick={() => handleNavigateToEnquiryPage('In Progress')}
        />
        <FunnelBar 
          label="Quotation & Followup" 
          amount={((stageCounts['Quotation'] || 0) + (stageCounts['Followup'] || 0)).toString()} 
          width="70%" 
          bgColor="bg-white/40"
          align="center"
          onClick={() => handleNavigateToEnquiryPage('Quotation')}
        />
        <FunnelBar 
          label="Negotiation" 
          amount={(stageCounts['Negotiation'] || 0).toString()} 
          width="55%" 
          bgColor="bg-white/40"
          align="end"
          onClick={() => handleNavigateToEnquiryPage('Negotiation')}
        />
        <FunnelBar 
          label="Won & Sales Order" 
          amount={((stageCounts['Won'] || 0) + (stageCounts['Sales Order'] || 0)).toString()} 
          width="40%" 
          bgColor="bg-green-100/50 text-green-800 border-green-200"
          align="start"
          onClick={() => handleNavigateToEnquiryPage('Won')}
        />
      </div>
    </GlassCard>
  );
}

function FunnelBar({ label, amount, width, bgColor, align = 'start', onClick }: { label: string, amount: string, width: string, bgColor: string, align?: 'start' | 'center' | 'end', onClick?: () => void }) {
  const alignClass = align === 'start' ? 'ml-0 mr-auto' : align === 'end' ? 'ml-auto mr-0' : 'mx-auto';
  
  return (
    <div 
      onClick={onClick}
      className={`relative rounded-full ${bgColor} border py-3 px-5 flex items-center justify-between shadow-sm cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${alignClass} max-w-full`}
      style={{ width }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-10">
        <span className="text-xs font-medium text-inherit opacity-80 truncate mr-2">{label}</span>
        <span className="font-semibold text-sm">{amount}</span>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/50 flex items-center justify-center hover:bg-white shadow-sm transition-colors text-neutral-600"
      >
        <ArrowUpRightIcon small />
      </button>
    </div>
  );
}

function ArrowUpRightIcon({ small = false }: { small?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={small ? "14" : "18"} height={small ? "14" : "18"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17l9.2-9.2M17 17V7H7"/>
    </svg>
  );
}
