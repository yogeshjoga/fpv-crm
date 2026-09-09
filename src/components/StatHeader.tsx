import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, CheckSquare, AlertCircle } from 'lucide-react';
import { getCRMStats } from '../utils/crmStore';

export function StatHeader({ title = "Customer Information", showBackButton = false }: { title?: string, showBackButton?: boolean }) {
  const [stats, setStats] = useState(getCRMStats());

  useEffect(() => {
    const handleUpdate = () => {
      setStats(getCRMStats());
    };
    
    // Subscribe to custom event to stay in perfect synchrony
    window.addEventListener('crm-store-update', handleUpdate);
    return () => {
      window.removeEventListener('crm-store-update', handleUpdate);
    };
  }, []);

  return (
    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-6">
      <div className="flex items-start gap-4">
        {showBackButton && (
          <button className="mt-2 w-10 h-10 flex items-center justify-center rounded-full bg-white/40 hover:bg-white/60 transition-colors border border-white/60 flex-shrink-0">
            <ArrowLeft size={18} className="text-neutral-600" />
          </button>
        )}
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight tracking-tight text-[#1a1a1a]">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex flex-nowrap items-center gap-6 xl:gap-8 overflow-x-auto scrollbar-none pb-2 xl:pb-0 w-full xl:w-auto -mx-4 px-4 md:mx-0 md:px-0">
        <StatItem 
          icon={<User size={20} />} 
          amount={stats.assignedToMe.toString()}
          subtitle="Enquiry Assigned to me"
        />
        <StatItem 
          icon={<CheckSquare size={20} />} 
          amount={stats.myTasks.toString()}
          subtitle="My Task"
          badge="Active"
          badgeColor="bg-amber-100 text-amber-700 border border-amber-200"
        />
        <StatItem 
          icon={<AlertCircle size={20} />} 
          amount={stats.totalPriorities.toString()}
          subtitle="Todays Priority's"
          badge="Urgent"
          badgeColor="bg-red-100 text-red-700 border border-red-200"
        />
      </div>
    </div>
  );
}

function StatItem({ icon, amount, subtitle, badge, badgeColor }: { icon: React.ReactNode, amount: string, subtitle: string, badge?: string, badgeColor?: string }) {
  return (
    <div className="flex items-start gap-4 shrink-0">
      <div className="w-12 h-12 rounded-full bg-white/50 border border-white/60 flex items-center justify-center text-neutral-700 shadow-sm flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-semibold">{amount}</span>
          {badge && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
