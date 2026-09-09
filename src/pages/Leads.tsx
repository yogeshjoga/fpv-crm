import React, { useState, useMemo, useEffect } from 'react';
import { Lead, LeadStatus } from '../data/mockLeads';
import { MOCK_USERS, MOCK_PRODUCTS } from '../data/mockData';
import { Search, Filter, Plus, Phone, Mail, Building2, UserCircle, Calendar, Eye, Edit2, CheckCircle2, MoreVertical, LayoutGrid, List, IndianRupee, MapPin, Tag, Columns } from 'lucide-react';
import { GlassCard } from '../components/ui/shared';
import { NewLead } from './Leads/NewLead';
import { Pagination } from '../components/ui/Pagination';
import { LeadDetail } from './Leads/LeadDetail';
import { LeadKanbanBoard } from '../components/LeadKanbanBoard';
import { getLeads, saveLeads, convertLeadToEnquiry } from '../utils/crmStore';

export function Leads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'All'>('All');
  const [filterAssigned, setFilterAssigned] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'card'>('kanban');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [viewState, setViewState] = useState<'list' | 'detail' | 'new'>('list');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === 'list' ? 6 : 9;

  const loadData = () => {
    const data = getLeads();
    setLeads(data);
  };

  useEffect(() => {
    loadData();
    const gotoLead = localStorage.getItem('crm_goto_lead');
    if (gotoLead) {
      setSelectedLeadId(Number(gotoLead));
      setViewState('detail');
      localStorage.removeItem('crm_goto_lead');
    }

    const handleStoreUpdate = () => loadData();
    window.addEventListener('crm-store-update', handleStoreUpdate);
    return () => window.removeEventListener('crm-store-update', handleStoreUpdate);
  }, []);

  const handleUpdateLeads = (newLeads: Lead[]) => {
    setLeads(newLeads);
    saveLeads(newLeads);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            lead.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            lead.leadNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            lead.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'All' || lead.status === filterStatus;
      const matchesAssigned = filterAssigned === 'All' || lead.assignedTo === filterAssigned;
      return matchesSearch && matchesStatus && matchesAssigned;
    });
  }, [leads, searchTerm, filterStatus, filterAssigned]);

  // Pagination logic
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  // Reset pagination when filters or view mode change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterAssigned, viewMode]);

  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case 'New': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Contacted': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Qualified': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Converted': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Unqualified': return 'bg-neutral-100 text-neutral-600 border-neutral-200';
      case 'Lost': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-neutral-50 text-neutral-700 border-neutral-200';
    }
  };

  // Dashboard Stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'New').length;
  const qualifiedLeads = leads.filter(l => l.status === 'Qualified').length;
  const convertedLeads = leads.filter(l => l.status === 'Converted').length;
  const totalValue = leads.reduce((sum, l) => sum + (l.potentialBusinessValue || 0), 0);

  const handleViewLead = (id: number) => {
    setSelectedLeadId(id);
    setViewState('detail');
  };

  const handleConvert = (id: number) => {
    convertLeadToEnquiry(id);
    loadData();
  };

  if (viewState === 'detail' && selectedLeadId) {
    const lead = leads.find(l => l.id === selectedLeadId);
    if (!lead) return null;
    return (
      <LeadDetail 
        lead={lead} 
        onBack={() => setViewState('list')} 
        onUpdate={(updatedLead) => {
          handleUpdateLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
        }}
      />
    );
  }

  if (viewState === 'new') {
    return (
      <NewLead 
        onBack={() => setViewState('list')} 
        onSave={(data) => {
          const newLead: Lead = {
            id: leads.length > 0 ? Math.max(...leads.map(l => l.id)) + 1 : 1,
            ...data
          };
          handleUpdateLeads([newLead, ...leads]);
          setViewState('list');
        }} 
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1a1a1a]">Lead Management</h1>
          <p className="text-neutral-500 mt-1 text-sm">Track, nurture, and convert potential business opportunities.</p>
        </div>
        <button 
          onClick={() => setViewState('new')}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1a1a] text-white rounded-full shadow-lg hover:bg-black transition-colors font-medium text-sm"
        >
          <Plus size={18} />
          <span>New Lead</span>
        </button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <GlassCard intensity="light" className="p-4 flex flex-col items-start border border-neutral-200/50">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Total Leads</span>
          <span className="text-2xl font-bold text-[#1a1a1a] mt-1">{totalLeads}</span>
        </GlassCard>
        <GlassCard intensity="light" className="p-4 flex flex-col items-start border border-blue-200/50">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">New Leads</span>
          <span className="text-2xl font-bold text-blue-600 mt-1">{newLeads}</span>
        </GlassCard>
        <GlassCard intensity="light" className="p-4 flex flex-col items-start border border-amber-200/50">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Qualified</span>
          <span className="text-2xl font-bold text-amber-600 mt-1">{qualifiedLeads}</span>
        </GlassCard>
        <GlassCard intensity="light" className="p-4 flex flex-col items-start border border-purple-200/50">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Converted</span>
          <span className="text-2xl font-bold text-purple-600 mt-1">{convertedLeads}</span>
        </GlassCard>
        <GlassCard intensity="light" className="p-4 flex flex-col items-start border border-emerald-200/50">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Pipeline Value</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1">₹{(totalValue / 100000).toFixed(2)} L</span>
        </GlassCard>
      </div>

      {/* Main Content Area */}
      <GlassCard intensity="light" className="p-4 md:p-6 w-full flex flex-col gap-6">
        {/* Controls, Filters & View Toggle */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 pb-2 border-b border-neutral-200/50">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Search by company, contact, lead ID, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-full py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm shadow-sm"
            />
          </div>
          
          {/* Filters & View Switches */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-full px-3 py-1.5 shadow-sm text-xs font-medium">
              <Filter size={14} className="text-neutral-500" />
              <span className="text-neutral-500">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'All')}
                className="bg-transparent focus:outline-none font-semibold text-neutral-800 cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Converted">Converted</option>
                <option value="Unqualified">Unqualified</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            {/* Assigned To Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-full px-3 py-1.5 shadow-sm text-xs font-medium">
              <UserCircle size={14} className="text-neutral-500" />
              <span className="text-neutral-500">Assigned:</span>
              <select
                value={filterAssigned}
                onChange={(e) => setFilterAssigned(e.target.value)}
                className="bg-transparent focus:outline-none font-semibold text-neutral-800 cursor-pointer"
              >
                <option value="All">All Sales Users</option>
                {MOCK_USERS.map(user => (
                  <option key={user.id} value={user.name}>{user.name}</option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle: Kanban vs List vs Card */}
            <div className="flex items-center bg-neutral-100 p-1 rounded-full border border-neutral-200 shadow-inner">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded-full transition-all flex items-center gap-1.5 text-xs font-medium ${
                  viewMode === 'kanban' 
                    ? 'bg-neutral-900 text-white shadow-sm font-bold' 
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
                title="Kanban Board View"
              >
                <Columns size={16} />
                <span className="hidden sm:inline">Kanban Board</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-full transition-all flex items-center gap-1.5 text-xs font-medium ${
                  viewMode === 'list' 
                    ? 'bg-white text-neutral-900 shadow-sm font-bold' 
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
                title="List View"
              >
                <List size={16} />
                <span className="hidden sm:inline">List View</span>
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-full transition-all flex items-center gap-1.5 text-xs font-medium ${
                  viewMode === 'card' 
                    ? 'bg-white text-neutral-900 shadow-sm font-bold' 
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
                title="Card View"
              >
                <LayoutGrid size={16} />
                <span className="hidden sm:inline">Card View</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Mode Content: KANBAN BOARD vs LIST VIEW vs CARD VIEW */}
        {viewMode === 'kanban' ? (
          <LeadKanbanBoard
            leads={filteredLeads}
            onViewLead={handleViewLead}
            onUpdateStatus={(id, newStatus) => {
              const updated = leads.map(l => l.id === id ? { ...l, status: newStatus } : l);
              handleUpdateLeads(updated);
            }}
            onConvertLead={handleConvert}
            onNewLeadWithStatus={() => setViewState('new')}
          />
        ) : viewMode === 'list' ? (
          /* TABLE / LIST VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/60 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="pb-3 px-4">Lead / Company</th>
                  <th className="pb-3 px-4">Contact Details</th>
                  <th className="pb-3 px-4 hidden md:table-cell">Assigned To</th>
                  <th className="pb-3 px-4 hidden lg:table-cell">Potential Value</th>
                  <th className="pb-3 px-4 hidden lg:table-cell">Next Follow-up</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginatedLeads.map((lead) => {
                  const nextFollowUp = (lead.followUps || []).find(f => f.status === 'Pending');
                  return (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      onClick={() => handleViewLead(lead.id)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-[#1a1a1a] text-sm group-hover:text-blue-600 transition-colors">
                            {lead.companyName}
                          </span>
                          <span className="text-xs text-neutral-500 flex items-center gap-1">
                            <Building2 size={12} /> {lead.industry} • {lead.city}
                          </span>
                          <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full w-fit border border-neutral-200">
                            {lead.leadNumber}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-neutral-800 flex items-center gap-1.5 text-xs">
                            <UserCircle size={14} className="text-neutral-400" />
                            {lead.contactPerson} ({lead.designation})
                          </span>
                          <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                            <Phone size={12} /> {lead.mobileNumber}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-neutral-700 hidden md:table-cell font-medium text-xs">
                        <div className="flex items-center gap-1.5 bg-neutral-100/80 px-2.5 py-1 rounded-full w-fit border border-neutral-200/60">
                          <UserCircle size={13} className="text-blue-600" />
                          <span>{lead.assignedTo}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 hidden lg:table-cell">
                        <span className="font-bold text-neutral-800 text-xs">
                          ₹{lead.potentialBusinessValue?.toLocaleString() || '0'}
                        </span>
                      </td>
                      <td className="py-4 px-4 hidden lg:table-cell">
                        {nextFollowUp ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(nextFollowUp.date).toLocaleDateString()}
                            </span>
                            <span className="text-[11px] text-neutral-500 truncate max-w-[140px]">
                              {nextFollowUp.remarks}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400 italic">No pending action</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleViewLead(lead.id); }}
                            className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" 
                            title="View Lead Details"
                          >
                            <Eye size={18} />
                          </button>
                          {lead.status === 'Qualified' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleConvert(lead.id); }}
                              className="p-1.5 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors" 
                              title="Convert to Enquiry"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                
                {paginatedLeads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 px-4 text-center">
                      <div className="flex flex-col items-center justify-center text-neutral-500">
                        <Search size={32} className="text-neutral-300 mb-2" />
                        <p className="font-bold text-neutral-800">No matching leads found</p>
                        <p className="text-xs mt-1 text-neutral-500">Try adjusting your search or filter options.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD VIEW (GRID OF CARDS) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedLeads.map((lead) => {
              const nextFollowUp = (lead.followUps || []).find(f => f.status === 'Pending');
              const matchedProduct = lead.interestedProducts?.[0] ? MOCK_PRODUCTS.find(p => p.id === lead.interestedProducts[0].productId) : null;

              return (
                <div 
                  key={lead.id} 
                  onClick={() => handleViewLead(lead.id)}
                  className="bg-white/80 border border-neutral-200/80 hover:border-blue-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
                >
                  <div>
                    {/* Card Header: Lead No, Status, Company */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full border border-neutral-200">
                          {lead.leadNumber}
                        </span>
                        <h3 className="font-bold text-base text-[#1a1a1a] mt-1.5 group-hover:text-blue-600 transition-colors">
                          {lead.companyName}
                        </h3>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </div>

                    {/* Contact details */}
                    <div className="space-y-1.5 text-xs text-neutral-600 mb-4 bg-neutral-50/80 p-3 rounded-xl border border-neutral-100">
                      <div className="flex items-center gap-2 font-medium text-neutral-900">
                        <UserCircle size={14} className="text-blue-600 shrink-0" />
                        <span>{lead.contactPerson} ({lead.designation})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-neutral-400 shrink-0" />
                        <span>{lead.mobileNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-neutral-400 shrink-0" />
                        <span>{lead.city}, {lead.state} • {lead.industry}</span>
                      </div>
                    </div>

                    {/* Product / Requirement info */}
                    {matchedProduct && (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-700 mb-3 bg-blue-50/50 px-2.5 py-1.5 rounded-lg border border-blue-100">
                        <Tag size={13} className="text-blue-600 shrink-0" />
                        <span className="font-semibold text-blue-900 truncate">Product: {matchedProduct.name}</span>
                      </div>
                    )}

                    {/* Potential Business Value & Assigned User */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100 text-xs">
                      <div>
                        <span className="text-neutral-400 font-medium block text-[11px]">Assigned To</span>
                        <span className="font-semibold text-neutral-800 flex items-center gap-1 mt-0.5">
                          <UserCircle size={13} className="text-neutral-500" />
                          {lead.assignedTo}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 font-medium block text-[11px]">Potential Value</span>
                        <span className="font-bold text-emerald-700 text-xs block mt-0.5">
                          ₹{lead.potentialBusinessValue?.toLocaleString() || '0'}
                        </span>
                      </div>
                    </div>

                    {/* Follow-up info if any */}
                    {nextFollowUp && (
                      <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs">
                        <span className="text-neutral-500 flex items-center gap-1 text-[11px]">
                          <Calendar size={12} className="text-blue-600" /> Next Follow-up:
                        </span>
                        <span className="font-semibold text-blue-700">
                          {new Date(nextFollowUp.date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-400">
                      Source: {lead.leadSource}
                    </span>
                    <div className="flex items-center gap-2">
                      {lead.status === 'Qualified' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConvert(lead.id); }}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold hover:bg-emerald-100 transition-colors"
                        >
                          Convert
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewLead(lead.id); }}
                        className="px-3 py-1 bg-[#1a1a1a] text-white rounded-full text-xs font-semibold hover:bg-black transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {paginatedLeads.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white/50 rounded-2xl border border-neutral-200">
                <Search size={32} className="text-neutral-300 mx-auto mb-2" />
                <p className="font-bold text-neutral-800">No matching leads found</p>
                <p className="text-xs text-neutral-500 mt-1">Try clearing filters or search terms.</p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {viewMode !== 'kanban' && (
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredLeads.length}
            itemsPerPage={itemsPerPage}
          />
        )}
      </GlassCard>
    </div>
  );
}
