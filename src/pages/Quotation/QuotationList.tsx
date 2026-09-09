import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, FileText, Calendar, User, Eye, Edit3, Trash2, 
  CheckCircle, Clock, AlertCircle, RefreshCw, X, Building2, Filter,
  TrendingUp, Send, FileCheck, Layers
} from 'lucide-react';
import { Quotation } from './types';
import { GlassCard } from '../../components/ui/shared';
import { Pagination } from '../../components/ui/Pagination';

interface QuotationListProps {
  quotations: Quotation[];
  onNew: () => void;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: Quotation['status']) => void;
}

export function QuotationList({ 
  quotations, onNew, onView, onEdit, onDelete, onStatusChange 
}: QuotationListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Quotation['status']>('All');
  const [partnerFilter, setPartnerFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Get unique partners from quotations for filtering
  const uniquePartners = useMemo(() => {
    return Array.from(new Set(quotations.map(q => q.companyName)));
  }, [quotations]);

  // Filter calculations
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const matchesSearch = 
        q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.contactName && q.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        q.salesExecutiveName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.enquiryNumber && q.enquiryNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'All' || q.status === statusFilter;
      const matchesPartner = partnerFilter === 'All' || q.companyName === partnerFilter;

      return matchesSearch && matchesStatus && matchesPartner;
    });
  }, [quotations, searchTerm, statusFilter, partnerFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage) || 1;
  const paginatedQuotations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQuotations.slice(start, start + itemsPerPage);
  }, [filteredQuotations, currentPage, itemsPerPage]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, partnerFilter]);

  // KPI Calculations
  const totalValue = quotations.reduce((sum, q) => sum + q.grandTotal, 0);
  const approvedValue = quotations
    .filter(q => q.status === 'Approved')
    .reduce((sum, q) => sum + q.grandTotal, 0);
  const draftCount = quotations.filter(q => q.status === 'Draft').length;
  const sentCount = quotations.filter(q => q.status === 'Sent').length;

  const getStatusBadge = (status: Quotation['status']) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-200/80 shadow-2xs">
            <CheckCircle size={12} className="text-emerald-600" /> Approved
          </span>
        );
      case 'Sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100/90 text-blue-800 border border-blue-200/80 shadow-2xs">
            <Send size={12} className="text-blue-600" /> Sent
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/90 text-amber-800 border border-amber-200/80 shadow-2xs">
            <Clock size={12} className="text-amber-600" /> Draft
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100/90 text-rose-800 border border-rose-200/80 shadow-2xs">
            <AlertCircle size={12} className="text-rose-600" /> Expired
          </span>
        );
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Quotations</h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Manage, generate, and share customer sales quotations with real-time tax & discount calculations.
          </p>
        </div>
        <button 
          onClick={onNew}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#1a1a1a] hover:bg-black text-white rounded-2xl font-bold text-xs transition-all shadow-md hover:shadow-lg active:scale-95 shrink-0"
        >
          <Plus size={16} />
          <span>Create Quotation</span>
        </button>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Quotes */}
        <GlassCard intensity="light" className="p-5 flex flex-col justify-between hover:border-blue-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">Total Quotations</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center">
              <FileText size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900">{quotations.length}</span>
              <span className="text-xs text-neutral-500 font-semibold">items created</span>
            </div>
            <div className="mt-2 text-xs text-neutral-500 font-medium flex items-center justify-between border-t border-neutral-100 pt-2">
              <span>Total Value</span>
              <span className="font-bold text-neutral-900">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        </GlassCard>

        {/* Approved Value */}
        <GlassCard intensity="light" className="p-5 flex flex-col justify-between hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">Approved Value</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center">
              <FileCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-800">{formatCurrency(approvedValue)}</span>
            </div>
            <div className="mt-2 text-xs text-neutral-500 font-medium flex items-center justify-between border-t border-neutral-100 pt-2">
              <span>Approved Deals</span>
              <span className="font-bold text-emerald-700">{quotations.filter(q => q.status === 'Approved').length} converted</span>
            </div>
          </div>
        </GlassCard>

        {/* Sent to Clients */}
        <GlassCard intensity="light" className="p-5 flex flex-col justify-between hover:border-sky-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">Sent to Clients</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/60 flex items-center justify-center">
              <Send size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-sky-900">{sentCount}</span>
              <span className="text-xs text-neutral-500 font-semibold">pending PO</span>
            </div>
            <div className="mt-2 text-xs text-neutral-500 font-medium flex items-center justify-between border-t border-neutral-100 pt-2">
              <span>Status</span>
              <span className="font-bold text-sky-700">Awaiting Feedback</span>
            </div>
          </div>
        </GlassCard>

        {/* Draft Offers */}
        <GlassCard intensity="light" className="p-5 flex flex-col justify-between hover:border-amber-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">Draft Offers</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-900">{draftCount}</span>
              <span className="text-xs text-neutral-500 font-semibold">in prep</span>
            </div>
            <div className="mt-2 text-xs text-neutral-500 font-medium flex items-center justify-between border-t border-neutral-100 pt-2">
              <span>Action</span>
              <span className="font-bold text-amber-700">Click edit to send</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Search and Filters panel */}
      <GlassCard intensity="light" className="p-4 border border-white/80 shadow-sm flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-neutral-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by quote number, customer, contact, executive..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-neutral-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-xs font-semibold text-neutral-900 placeholder:text-neutral-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-xs font-semibold text-neutral-800"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Approved">Approved</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          {/* Business Partner Filter */}
          <div>
            <select
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-xs font-semibold text-neutral-800"
            >
              <option value="All">All Customers</option>
              {uniquePartners.map((partner, idx) => (
                <option key={idx} value={partner}>{partner}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {(searchTerm || statusFilter !== 'All' || partnerFilter !== 'All') && (
          <div className="flex items-center justify-between border-t border-neutral-100/80 pt-2.5 mt-0.5">
            <span className="text-xs text-neutral-500 font-medium">
              Showing <strong className="text-neutral-900">{filteredQuotations.length}</strong> of {quotations.length} total quotations
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setPartnerFilter('All');
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 hover:underline"
            >
              Clear Filters
            </button>
          </div>
        )}
      </GlassCard>

      {/* Main Table Layout */}
      <div className="bg-white border border-neutral-200/80 rounded-[2rem] overflow-hidden shadow-sm">
        {filteredQuotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center mb-4 text-neutral-400 shadow-2xs">
              <FileText size={26} />
            </div>
            <h3 className="font-bold text-base text-neutral-900">No Quotations Found</h3>
            <p className="text-xs text-neutral-500 max-w-sm mt-1">
              {searchTerm || statusFilter !== 'All' || partnerFilter !== 'All'
                ? "No quotes match your search filters. Try resetting the filters or modifying your query."
                : "Get started by creating your first sales quotation. Select companies and products to auto-fill details."}
            </p>
            {searchTerm || statusFilter !== 'All' || partnerFilter !== 'All' ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('All');
                  setPartnerFilter('All');
                }}
                className="mt-4 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold rounded-xl text-xs transition-colors"
              >
                Reset Search Filters
              </button>
            ) : (
              <button
                onClick={onNew}
                className="mt-4 px-5 py-2.5 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Create Quotation Now
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-extrabold text-neutral-400 tracking-wider uppercase">
                    <th className="py-4 px-6">Quote Number</th>
                    <th className="py-4 px-6">Client Company</th>
                    <th className="py-4 px-6">Date & Validity</th>
                    <th className="py-4 px-6">Sales Owner</th>
                    <th className="py-4 px-6 text-right">Quote Amount</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {paginatedQuotations.map((quote) => (
                    <tr 
                      key={quote.id}
                      className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                      onClick={() => onView(quote.id)}
                    >
                      {/* Number */}
                      <td className="py-4 px-6 font-mono font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">
                        <div className="flex flex-col">
                          <span>{quote.quotationNumber}</span>
                          {quote.enquiryNumber && (
                            <span className="text-[10px] text-neutral-400 font-mono mt-0.5">
                              Ref: {quote.enquiryNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-neutral-500 shrink-0 font-bold text-xs">
                            <Building2 size={14} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-neutral-900 truncate">{quote.companyName}</span>
                            {quote.contactName && (
                              <span className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5 font-medium truncate">
                                <User size={11} className="text-neutral-400" /> {quote.contactName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 text-neutral-600">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-neutral-700 font-medium">
                            <Calendar size={12} className="text-neutral-400" /> Issue: {quote.date}
                          </span>
                          <span className="text-neutral-400 pl-4 text-[11px]">
                            Valid: {quote.validUntil}
                          </span>
                        </div>
                      </td>

                      {/* Sales Owner */}
                      <td className="py-4 px-6 text-neutral-600">
                        <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 text-xs rounded-lg font-semibold border border-neutral-200/60">
                          {quote.salesExecutiveName}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-6 text-right font-extrabold text-neutral-900 font-mono text-sm">
                        {formatCurrency(quote.grandTotal)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left group/status">
                          {getStatusBadge(quote.status)}
                          
                          {/* Inline Status Changer Dropdown */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 bg-white border border-neutral-200 rounded-xl shadow-xl p-1 hidden group-hover/status:flex items-center gap-1 z-20 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
                            {quote.status !== 'Draft' && (
                              <button
                                onClick={() => onStatusChange(quote.id, 'Draft')}
                                className="px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              >
                                Draft
                              </button>
                            )}
                            {quote.status !== 'Sent' && (
                              <button
                                onClick={() => onStatusChange(quote.id, 'Sent')}
                                className="px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                Sent
                              </button>
                            )}
                            {quote.status !== 'Approved' && (
                              <button
                                onClick={() => onStatusChange(quote.id, 'Approved')}
                                className="px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            {quote.status !== 'Expired' && (
                              <button
                                onClick={() => onStatusChange(quote.id, 'Expired')}
                                className="px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                Expire
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onView(quote.id)}
                            title="View Quotation PDF & Document"
                            className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => onEdit(quote.id)}
                            title="Edit Quotation details"
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-neutral-500 hover:text-blue-600 transition-colors"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete quotation ${quote.quotationNumber}?`)) {
                                onDelete(quote.id);
                              }
                            }}
                            title="Delete Quotation"
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-neutral-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Component */}
            <div className="p-3 bg-neutral-50/50 border-t border-neutral-100">
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredQuotations.length}
                itemsPerPage={itemsPerPage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

