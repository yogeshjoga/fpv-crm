import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  TrendingUp, 
  MessageSquare, 
  ScrollText, 
  Building2, 
  Calendar, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Command, 
  Filter,
  Layers,
  Zap,
  Tag,
  ChevronRight,
  Compass
} from 'lucide-react';
import { getLeads, getEnquiries, getQuotations, getPartners, getTasks, Task } from '../utils/crmStore';
import { Lead } from '../data/mockLeads';
import { Enquiry } from '../data/mockData';

export interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SearchCategory = 'All' | 'Leads' | 'Enquiries' | 'Quotations' | 'Tasks' | 'Partners' | 'Pages';

interface SearchResultItem {
  type: 'Lead' | 'Enquiry' | 'Quotation' | 'Task' | 'Partner' | 'Page';
  id: string | number;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  tag?: string;
  page: string;
  itemKey?: string;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCategory('All');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keydown handler for shortcut Ctrl+K / Cmd+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via custom event or props if managed locally
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Navigation & Keyboard handling inside search modal
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (resultsContainerRef.current) {
      const selectedEl = resultsContainerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Calculate search results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const pagesResult: SearchResultItem[] = [
      { type: 'Page' as const, id: 'page-home', title: 'Dashboard & Overview', subtitle: 'Main CRM overview workspace', page: 'Dashboard', tag: 'Navigation' },
      { type: 'Page' as const, id: 'page-leads', title: 'Lead Management Directory', subtitle: 'Track prospects, qualify & convert', page: 'Leads', tag: 'Workspace' },
      { type: 'Page' as const, id: 'page-enquiry', title: 'Enquiry Pipelines', subtitle: 'Manage active enquiry pipeline stages', page: 'Enquiry', tag: 'Workspace' },
      { type: 'Page' as const, id: 'page-schedule', title: 'Schedule Desk & Tasks', subtitle: 'Calendar, meetings & follow-ups', page: 'Schedule', tag: 'Workspace' },
      { type: 'Page' as const, id: 'page-analytics', title: 'CRM Analytics & Reports', subtitle: 'Business performance metrics', page: 'Analytics', tag: 'Workspace' },
      { type: 'Page' as const, id: 'page-partner', title: 'Business Partners Directory', subtitle: 'Vendors, dealers & client accounts', page: 'Business Partner', tag: 'Workspace' },
      { type: 'Page' as const, id: 'page-settings', title: 'Operator Settings & Profile', subtitle: 'Manage CRM preferences', page: 'Settings', tag: 'System' }
    ];

    const filteredPages = pagesResult.filter(p => !q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q));

    if (!q) {
      // Empty query default view - return curated quick picks based on active category
      if (category === 'Pages') return pagesResult;
      return [];
    }

    const leads: SearchResultItem[] = getLeads()
      .filter(l => 
        l.companyName.toLowerCase().includes(q) ||
        l.leadNumber.toLowerCase().includes(q) ||
        l.contactPerson.toLowerCase().includes(q) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.leadDescription && l.leadDescription.toLowerCase().includes(q))
      )
      .map(l => ({
        type: 'Lead',
        id: l.id,
        title: l.companyName,
        subtitle: `Lead #${l.leadNumber} • ${l.contactPerson} (${l.city || 'Location N/A'})`,
        badge: l.status,
        badgeColor: l.status === 'Qualified' ? 'bg-emerald-100 text-emerald-800' : l.status === 'New' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800',
        page: 'Leads',
        itemKey: 'crm_goto_lead',
        tag: `₹${(l.potentialBusinessValue || 0).toLocaleString('en-IN')}`
      }));

    const enquiries: SearchResultItem[] = getEnquiries()
      .filter(e => 
        e.enquiryNumber.toLowerCase().includes(q) ||
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        e.assignedTo.toLowerCase().includes(q)
      )
      .map(e => ({
        type: 'Enquiry',
        id: e.id,
        title: e.enquiryNumber,
        subtitle: e.title || `Requirement for company ID #${e.companyId}`,
        badge: e.stage || e.status,
        badgeColor: 'bg-blue-100 text-blue-800',
        page: 'Enquiry',
        itemKey: 'crm_goto_enquiry',
        tag: e.assignedTo
      }));

    const quotations: SearchResultItem[] = getQuotations()
      .filter(qt => 
        qt.quoteNumber.toLowerCase().includes(q) ||
        qt.enquiryNumber.toLowerCase().includes(q)
      )
      .map(qt => ({
        type: 'Quotation',
        id: qt.id,
        title: qt.quoteNumber,
        subtitle: `Quotation for ${qt.enquiryNumber}`,
        badge: qt.status || 'Draft',
        badgeColor: 'bg-purple-100 text-purple-800',
        page: 'Quotation',
        itemKey: 'crm_goto_quote',
        tag: `₹${(qt.totalAmount || 0).toLocaleString('en-IN')}`
      }));

    const partners: SearchResultItem[] = getPartners()
      .filter(p => 
        p.name.toLowerCase().includes(q) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.industry && p.industry.toLowerCase().includes(q)) ||
        p.type.toLowerCase().includes(q)
      )
      .map(p => ({
        type: 'Partner',
        id: p.id,
        title: p.name,
        subtitle: `${p.type} • ${p.city || 'India'} (${p.industry || 'General'})`,
        badge: p.type,
        badgeColor: 'bg-teal-100 text-teal-800',
        page: 'Business Partner',
        itemKey: 'crm_goto_partner',
        tag: p.phone
      }));

    const tasks: SearchResultItem[] = getTasks()
      .filter(t => 
        t.title.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q)
      )
      .map(t => ({
        type: 'Task',
        id: t.id,
        title: t.title,
        subtitle: `Assigned to ${t.assignee} • Due ${t.dueDate}`,
        badge: t.completed ? 'Completed' : t.priority,
        badgeColor: t.completed ? 'bg-neutral-100 text-neutral-600' : 'bg-rose-100 text-rose-800',
        page: 'Schedule',
        itemKey: 'crm_goto_task',
        tag: t.completed ? 'Done' : 'Pending'
      }));

    let all: SearchResultItem[] = [];

    if (category === 'Leads') all = leads;
    else if (category === 'Enquiries') all = enquiries;
    else if (category === 'Quotations') all = quotations;
    else if (category === 'Partners') all = partners;
    else if (category === 'Tasks') all = tasks;
    else if (category === 'Pages') all = filteredPages;
    else {
      // 'All' category combines everything thoughtfully
      all = [...filteredPages, ...leads, ...enquiries, ...quotations, ...partners, ...tasks];
    }

    return all.slice(0, 12);
  }, [query, category]);

  // Reset selected index when query or results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, category]);

  const handleSelectResult = (item: SearchResultItem) => {
    if (item.itemKey) {
      localStorage.setItem(item.itemKey, item.id.toString());
    }
    window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
      detail: { workspace: 'Home', page: item.page }
    }));
    onClose();
  };

  const applyQuickSearch = (keyword: string) => {
    setQuery(keyword);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs flex items-start justify-center pt-12 md:pt-20 z-[100] p-3 md:p-4 animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-neutral-200/80 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        {/* Top Input Bar */}
        <div className="p-4 border-b border-neutral-100 flex items-center gap-3 bg-neutral-50/80 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 text-blue-700 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-2xs">
            <Search size={18} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search leads, enquiries, tasks, quotations, partners..."
            className="w-full bg-transparent border-none text-sm font-semibold text-neutral-900 outline-none placeholder:text-neutral-400 placeholder:font-normal"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs font-bold text-neutral-400 hover:text-neutral-700 px-2 py-1 rounded-md bg-neutral-200/60 transition-colors shrink-0"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-neutral-200/60 border border-neutral-200/60 flex items-center justify-center text-neutral-400 hover:text-neutral-800 transition-colors shrink-0"
            title="Close Search (ESC)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-2 border-b border-neutral-100 bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {(['All', 'Leads', 'Enquiries', 'Quotations', 'Tasks', 'Partners', 'Pages'] as SearchCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                category === cat
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results / Quick Picks Body */}
        <div 
          ref={resultsContainerRef}
          className="p-3 overflow-y-auto flex-1 custom-scrollbar space-y-1 min-h-[220px]"
        >
          {query.trim() === '' ? (
            <div className="p-4 space-y-5">
              {/* Quick Search Chips */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5">
                  <Zap size={13} className="text-amber-500" /> Suggested Searches
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Astral Ltd',
                    'Godrej Agrovet',
                    'Qualified Leads',
                    'High Priority',
                    'RO Antiscalant',
                    'Mumbai'
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => applyQuickSearch(chip)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-xs font-semibold border border-neutral-200/60 transition-all flex items-center gap-1"
                    >
                      <Search size={11} className="text-neutral-400" />
                      <span>{chip}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Navigation Pages */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5">
                  <Compass size={13} className="text-blue-500" /> Workspaces & Tools
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { title: 'Lead Management', page: 'Leads', desc: 'Convert prospects to enquiries', color: 'bg-amber-50 text-amber-800 border-amber-200/60' },
                    { title: 'Enquiry Pipelines', page: 'Enquiry', desc: 'Active customer requirements', color: 'bg-blue-50 text-blue-800 border-blue-200/60' },
                    { title: 'Schedule Desk', page: 'Schedule', desc: 'Calendar & task execution', color: 'bg-violet-50 text-violet-800 border-violet-200/60' },
                    { title: 'Business Partners', page: 'Business Partner', desc: 'Dealers, vendors & clients', color: 'bg-teal-50 text-teal-800 border-teal-200/60' }
                  ].map((item) => (
                    <button
                      key={item.page}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
                          detail: { workspace: 'Home', page: item.page }
                        }));
                        onClose();
                      }}
                      className="p-3 rounded-2xl bg-white border border-neutral-200/80 hover:border-neutral-400 hover:shadow-2xs transition-all text-left flex items-center justify-between gap-2 group"
                    >
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${item.color} inline-block mb-1`}>
                          {item.title}
                        </span>
                        <p className="text-xs text-neutral-500 font-medium line-clamp-1">{item.desc}</p>
                      </div>
                      <ChevronRight size={15} className="text-neutral-300 group-hover:text-neutral-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center">
                <Filter size={20} />
              </div>
              <p className="font-bold text-sm text-neutral-800">No records found</p>
              <p className="text-xs text-neutral-500 max-w-xs">
                No matching leads, enquiries, quotations or partners for "{query}". Try a different keyword or category.
              </p>
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={`${item.type}-${item.id}-${index}`}
                  data-index={index}
                  onClick={() => handleSelectResult(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 border ${
                    isSelected 
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-md' 
                      : 'bg-white hover:bg-neutral-50 border-neutral-200/60 text-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-neutral-800 border-neutral-700 text-white' :
                      item.type === 'Lead' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      item.type === 'Enquiry' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      item.type === 'Quotation' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      item.type === 'Task' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      item.type === 'Partner' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                      'bg-neutral-100 text-neutral-700 border-neutral-200'
                    }`}>
                      {item.type === 'Lead' && <TrendingUp size={16} />}
                      {item.type === 'Enquiry' && <MessageSquare size={16} />}
                      {item.type === 'Quotation' && <ScrollText size={16} />}
                      {item.type === 'Task' && <Calendar size={16} />}
                      {item.type === 'Partner' && <Building2 size={16} />}
                      {item.type === 'Page' && <Compass size={16} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {item.type}
                        </span>
                        {item.badge && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md ${
                            isSelected ? 'bg-neutral-800 text-neutral-200' : item.badgeColor || 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-neutral-900'}`}>
                        {item.title}
                      </p>
                      <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.tag && (
                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg hidden sm:inline-block ${
                        isSelected ? 'bg-neutral-800 text-neutral-200' : 'bg-neutral-100 text-neutral-700'
                      }`}>
                        {item.tag}
                      </span>
                    )}
                    <ArrowRight size={14} className={isSelected ? 'text-white' : 'text-neutral-400'} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Bar with Keyboard shortcuts */}
        <div className="p-3 px-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-medium shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded text-[10px] font-mono shadow-2xs">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded text-[10px] font-mono shadow-2xs">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded text-[10px] font-mono shadow-2xs">ESC</kbd> Close
            </span>
          </div>

          <span className="font-semibold text-neutral-600 hidden sm:inline">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
