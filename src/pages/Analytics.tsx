import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, Target, Activity, DollarSign, Calendar, CheckCircle2, ArrowUpRight, ArrowDownRight, Package, ShieldCheck
} from 'lucide-react';
import { getEnquiries, getLeads, getPartners, getTasks, getQuotations } from '../utils/crmStore';
import { GlassCard } from '../components/ui/shared';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export function Analytics() {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  
  const [data, setData] = useState({
    enquiries: [],
    leads: [],
    partners: [],
    tasks: [],
    quotations: []
  });

  useEffect(() => {
    // Load fresh data
    setData({
      enquiries: getEnquiries(),
      leads: getLeads(),
      partners: getPartners(),
      tasks: getTasks(),
      quotations: getQuotations() || []
    });
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const { enquiries, leads, partners } = data;
    
    // Active enquiries
    const activeEnquiries = enquiries.filter(e => !['Closed', 'Lost'].includes(e.status)).length;
    
    // Won/Lost for Win Rate
    const won = enquiries.filter(e => e.stage === 'Won').length;
    const closed = enquiries.filter(e => ['Won', 'Lost'].includes(e.stage)).length;
    const winRate = closed > 0 ? Math.round((won / closed) * 100) : 0;

    // Total potential value from leads
    const totalPipeline = leads.reduce((acc, l) => acc + (l.potentialBusinessValue || 0), 0);
    
    return {
      activeEnquiries,
      totalLeads: leads.length,
      winRate,
      totalPipeline,
      totalPartners: partners.length
    };
  }, [data]);

  // Lead Conversion Funnel
  const leadFunnelData = useMemo(() => {
    const { leads } = data;
    const stages = ['New', 'Contacted', 'Qualified', 'Converted'];
    return stages.map(stage => ({
      name: stage,
      count: leads.filter(l => l.status === stage).length
    }));
  }, [data]);

  // Enquiries over time (Mocking a timeline for charting by aggregating by date)
  const timelineData = useMemo(() => {
    const { enquiries, leads } = data;
    const map = new Map<string, { date: string, enquiries: number, leads: number }>();
    
    [...enquiries, ...leads].forEach(item => {
      const dateRaw = 'date' in item ? item.date : (item as any).createdDate;
      if (!dateRaw) return;
      const d = new Date(dateRaw);
      if (isNaN(d.getTime())) return;
      
      const key = d.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, { date: key, enquiries: 0, leads: 0 });
      
      if ('date' in item) {
        map.get(key)!.enquiries += 1;
      } else {
        map.get(key)!.leads += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-10); // Last 10 days of activity
  }, [data]);

  // Enquiry status distribution
  const statusData = useMemo(() => {
    const { enquiries } = data;
    const map = new Map<string, number>();
    enquiries.forEach(e => {
      map.set(e.status, (map.get(e.status) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  const formatCurrency = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Analytics Overview</h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Comprehensive business intelligence, performance metrics, and sales pipeline analytics.
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="bg-neutral-200/60 p-1 rounded-2xl border border-neutral-200/80 inline-flex items-center gap-1 shrink-0">
          {(['7d', '30d', '90d', '1y', 'all'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize ${
                timeframe === tf
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
              }`}
            >
              {tf === 'all' ? 'All Time' : tf}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard intensity="light" className="p-5 flex flex-col justify-between hover:border-blue-200 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">Total Pipeline Value</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900">{formatCurrency(stats.totalPipeline)}</span>
            </div>
            <div className="mt-2 text-xs text-neutral-500 font-medium flex items-center justify-between border-t border-neutral-100 pt-2">
              <span>vs Last Period</span>
              <span className="font-bold text-emerald-600 flex items-center gap-0.5"><ArrowUpRight size={14} /> 12.5%</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard intensity="light" className="p-5 flex flex-col justify-between hover:border-emerald-200 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">Win Rate</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Target size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900">{stats.winRate}%</span>
              <span className="text-xs text-neutral-500 font-semibold">overall</span>
            </div>
            <div className="mt-2 text-xs text-neutral-500 font-medium flex items-center justify-between border-t border-neutral-100 pt-2">
              <span>Conversion</span>
              <span className="font-bold text-emerald-600 flex items-center gap-0.5"><ArrowUpRight size={14} /> 4.2%</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard intensity="light" className="p-5 flex flex-col justify-between hover:border-purple-200 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">Active Enquiries</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Activity size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900">{stats.activeEnquiries}</span>
              <span className="text-xs text-neutral-500 font-semibold">in progress</span>
            </div>
            <div className="mt-2 text-xs text-neutral-500 font-medium flex items-center justify-between border-t border-neutral-100 pt-2">
              <span>Avg Resolution</span>
              <span className="font-bold text-purple-700">14 Days</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard intensity="light" className="p-5 flex flex-col justify-between hover:border-amber-200 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">Total Partners</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900">{stats.totalPartners}</span>
              <span className="text-xs text-neutral-500 font-semibold">B2B accounts</span>
            </div>
            <div className="mt-2 text-xs text-neutral-500 font-medium flex items-center justify-between border-t border-neutral-100 pt-2">
              <span>New this Month</span>
              <span className="font-bold text-amber-700">+3 added</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Line Chart */}
        <GlassCard intensity="light" className="p-6 lg:col-span-2 border border-white/80 shadow-sm flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-neutral-900">Lead & Enquiry Volume Trend</h3>
              <p className="text-xs text-neutral-500 mt-1">Daily volume comparison over the selected timeframe.</p>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEnquiries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e5e5', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 600 }}
                  labelStyle={{ fontSize: '12px', color: '#737373', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} />
                <Area type="monotone" dataKey="leads" name="New Leads" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="enquiries" name="Enquiries Created" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorEnquiries)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Lead Funnel Chart */}
        <GlassCard intensity="light" className="p-6 border border-white/80 shadow-sm flex flex-col min-h-[400px]">
          <div className="mb-6">
            <h3 className="font-bold text-neutral-900">Sales Funnel</h3>
            <p className="text-xs text-neutral-500 mt-1">Lead progression across active stages.</p>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadFunnelData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e5e5" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#525252', fontWeight: 600 }} width={80} />
                <RechartsTooltip 
                  cursor={{ fill: '#f5f5f5' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e5e5', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}
                  labelStyle={{ display: 'none' }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} barSize={32}>
                  {
                    leadFunnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Enquiry Status Pie Chart */}
        <GlassCard intensity="light" className="p-6 lg:col-span-1 border border-white/80 shadow-sm flex flex-col min-h-[350px]">
          <div className="mb-2">
            <h3 className="font-bold text-neutral-900">Enquiry Status Distribution</h3>
          </div>
          <div className="flex-1 min-h-[250px] flex items-center justify-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e5e5', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-neutral-400 text-sm">No enquiries data available</p>
            )}
          </div>
        </GlassCard>

        {/* Recent Performance Metric List */}
        <GlassCard intensity="light" className="p-6 lg:col-span-2 border border-white/80 shadow-sm flex flex-col min-h-[350px]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-neutral-900">Key Conversion Events</h3>
              <p className="text-xs text-neutral-500 mt-1">Recently won enquiries and converted leads.</p>
            </div>
            <button className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">View All Report</button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-extrabold text-neutral-400 tracking-wider uppercase">
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Title / Name</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Assigned To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-700">
                {/* We map a few won enquiries or converted leads for the demo */}
                {data.enquiries.filter(e => e.stage === 'Won').slice(0, 3).map((e, idx) => (
                  <tr key={`enq-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px]">Enquiry Won</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-900">{e.title}</td>
                    <td className="py-3 px-4 text-emerald-600 font-bold">-</td>
                    <td className="py-3 px-4">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4">{e.assignedTo}</td>
                  </tr>
                ))}
                {data.leads.filter(l => l.status === 'Converted').slice(0, 3).map((l, idx) => (
                  <tr key={`lead-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">Lead Converted</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-900">{l.companyName}</td>
                    <td className="py-3 px-4 text-emerald-600 font-bold">{formatCurrency(l.potentialBusinessValue || 0)}</td>
                    <td className="py-3 px-4">{new Date(l.createdDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4">{l.assignedTo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

      </div>
    </div>
  );
}
