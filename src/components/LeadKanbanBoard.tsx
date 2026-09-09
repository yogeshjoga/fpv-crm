import React, { useState } from 'react';
import { Lead, LeadStatus } from '../data/mockLeads';
import { 
  Building2, UserCircle, Phone, Calendar, Eye, CheckCircle2, 
  Plus, ChevronLeft, ChevronRight, Tag, IndianRupee, Layers, MoveRight, Clock
} from 'lucide-react';
import { MOCK_PRODUCTS } from '../data/mockData';

interface LeadKanbanBoardProps {
  leads: Lead[];
  onViewLead: (id: number) => void;
  onUpdateStatus: (id: number, newStatus: LeadStatus) => void;
  onConvertLead: (id: number) => void;
  onNewLeadWithStatus?: (status: LeadStatus) => void;
}

const STAGES: { id: LeadStatus; label: string; color: string; border: string; bg: string; dot: string }[] = [
  { id: 'New', label: 'New Lead', color: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50/80', dot: 'bg-blue-500' },
  { id: 'Contacted', label: 'Contacted', color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50/80', dot: 'bg-amber-500' },
  { id: 'Qualified', label: 'Qualified', color: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50/80', dot: 'bg-emerald-500' },
  { id: 'Converted', label: 'Converted', color: 'text-purple-700', border: 'border-purple-200', bg: 'bg-purple-50/80', dot: 'bg-purple-500' },
  { id: 'Unqualified', label: 'Unqualified', color: 'text-neutral-600', border: 'border-neutral-200', bg: 'bg-neutral-100/80', dot: 'bg-neutral-400' },
  { id: 'Lost', label: 'Lost', color: 'text-rose-700', border: 'border-rose-200', bg: 'bg-rose-50/80', dot: 'bg-rose-500' },
];

export function LeadKanbanBoard({ 
  leads, 
  onViewLead, 
  onUpdateStatus, 
  onConvertLead,
  onNewLeadWithStatus
}: LeadKanbanBoardProps) {
  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null);

  const formatCurrency = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L`;
    }
    return `₹${val.toLocaleString()}`;
  };

  const getNextStage = (current: LeadStatus): LeadStatus | null => {
    const idx = STAGES.findIndex(s => s.id === current);
    return idx < STAGES.length - 1 ? STAGES[idx + 1].id : null;
  };

  const getPrevStage = (current: LeadStatus): LeadStatus | null => {
    const idx = STAGES.findIndex(s => s.id === current);
    return idx > 0 ? STAGES[idx - 1].id : null;
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-[1300px]">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter(l => l.status === stage.id);
          const totalValue = stageLeads.reduce((sum, l) => sum + (l.potentialBusinessValue || 0), 0);
          const isOver = dragOverStage === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                if (draggedLeadId) {
                  onUpdateStatus(draggedLeadId, stage.id);
                  setDraggedLeadId(null);
                }
              }}
              className={`flex-1 min-w-[260px] max-w-[320px] rounded-2xl border transition-all flex flex-col max-h-[800px] ${
                isOver ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20 shadow-md' : 'bg-neutral-50/60 border-neutral-200/80'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-neutral-200/60 flex items-center justify-between bg-white/60 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                  <span className="font-bold text-xs text-neutral-900 tracking-tight">{stage.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${stage.bg} ${stage.color} ${stage.border}`}>
                    {stageLeads.length}
                  </span>
                </div>

                {onNewLeadWithStatus && (
                  <button
                    onClick={() => onNewLeadWithStatus(stage.id)}
                    title={`Add new lead in ${stage.label}`}
                    className="p-1 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/60 rounded-lg transition-colors"
                  >
                    <Plus size={15} />
                  </button>
                )}
              </div>

              {/* Stage Value Metric Bar */}
              <div className="px-3.5 py-1.5 bg-neutral-100/50 text-[11px] font-semibold text-neutral-500 border-b border-neutral-200/40 flex items-center justify-between">
                <span>Stage Value:</span>
                <span className="font-bold text-neutral-900">{formatCurrency(totalValue)}</span>
              </div>

              {/* Cards Container */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[160px]">
                {stageLeads.map((lead) => {
                  const nextFollowUp = (lead.followUps || []).find(f => f.status === 'Pending');
                  const prevStage = getPrevStage(lead.status);
                  const nextStage = getNextStage(lead.status);

                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggedLeadId(lead.id)}
                      onClick={() => onViewLead(lead.id)}
                      className="bg-white border border-neutral-200/90 hover:border-neutral-400 rounded-xl p-3.5 shadow-2xs hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group relative flex flex-col justify-between gap-2.5"
                    >
                      {/* Top Row: Lead Number & Quick Stage Select */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200/60">
                          {lead.leadNumber}
                        </span>

                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {prevStage && (
                            <button
                              onClick={() => onUpdateStatus(lead.id, prevStage)}
                              title={`Move back to ${prevStage}`}
                              className="p-1 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-800 rounded-md transition-colors"
                            >
                              <ChevronLeft size={13} />
                            </button>
                          )}
                          {nextStage && (
                            <button
                              onClick={() => onUpdateStatus(lead.id, nextStage)}
                              title={`Advance to ${nextStage}`}
                              className="p-1 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-800 rounded-md transition-colors"
                            >
                              <ChevronRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Company Name & Industry */}
                      <div>
                        <h4 className="font-bold text-xs text-neutral-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {lead.companyName}
                        </h4>
                        <p className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5 font-medium truncate">
                          <Building2 size={11} className="shrink-0 text-neutral-400" />
                          <span>{lead.industry} • {lead.city}</span>
                        </p>
                      </div>

                      {/* Contact Info */}
                      <div className="text-[11px] text-neutral-600 bg-neutral-50 p-2 rounded-lg border border-neutral-100 space-y-0.5">
                        <p className="font-semibold text-neutral-800 truncate flex items-center gap-1">
                          <UserCircle size={12} className="text-blue-600 shrink-0" />
                          <span>{lead.contactPerson}</span>
                        </p>
                        <p className="text-neutral-500 flex items-center gap-1 truncate">
                          <Phone size={10} className="shrink-0 text-neutral-400" />
                          <span>{lead.mobileNumber}</span>
                        </p>
                      </div>

                      {/* Value & Rep */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-100">
                        <div>
                          <span className="text-[10px] text-neutral-400 font-semibold block">Potential</span>
                          <span className="font-bold text-emerald-700">
                            ₹{lead.potentialBusinessValue?.toLocaleString() || '0'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-neutral-400 font-semibold block">Assigned</span>
                          <span className="font-bold text-neutral-700 flex items-center gap-1 justify-end">
                            <UserCircle size={11} className="text-neutral-400" />
                            {lead.assignedTo.split(' ')[0]}
                          </span>
                        </div>
                      </div>

                      {/* Follow-up Pill if pending */}
                      {nextFollowUp && (
                        <div className="bg-blue-50/70 border border-blue-100 text-blue-800 px-2 py-1 rounded-md text-[10px] font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Clock size={10} className="text-blue-600" /> Next Action:
                          </span>
                          <span>{new Date(nextFollowUp.date).toLocaleDateString()}</span>
                        </div>
                      )}

                      {/* Bottom Action Footer */}
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-100 mt-1" onClick={e => e.stopPropagation()}>
                        <select
                          value={lead.status}
                          onChange={(e) => onUpdateStatus(lead.id, e.target.value as LeadStatus)}
                          className="text-[10px] font-bold bg-neutral-50 border border-neutral-200 rounded-md px-1.5 py-0.5 text-neutral-700 focus:outline-none cursor-pointer"
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Qualified">Qualified</option>
                          <option value="Converted">Converted</option>
                          <option value="Unqualified">Unqualified</option>
                          <option value="Lost">Lost</option>
                        </select>

                        <div className="flex items-center gap-1">
                          {lead.status === 'Qualified' && (
                            <button
                              onClick={() => onConvertLead(lead.id)}
                              title="Convert to Enquiry"
                              className="p-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 rounded-md transition-colors text-[10px] font-bold flex items-center gap-0.5"
                            >
                              <CheckCircle2 size={11} /> Convert
                            </button>
                          )}
                          <button
                            onClick={() => onViewLead(lead.id)}
                            className="p-1 bg-neutral-900 text-white hover:bg-black rounded-md transition-colors text-[10px] font-bold"
                          >
                            <Eye size={11} />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}

                {stageLeads.length === 0 && (
                  <div className="h-28 border border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center text-center p-3 text-neutral-400">
                    <p className="text-xs font-semibold">No leads</p>
                    <p className="text-[10px] mt-0.5">Drag cards here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
