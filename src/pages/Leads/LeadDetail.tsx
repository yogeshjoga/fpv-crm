import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Phone, Mail, MapPin, Building2, UserCircle, Save, Edit2, Calendar, X, Plus, ChevronRight, FileText, ArrowUpRight, AlertCircle, Sparkles } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';
import { Lead, LeadStatus, LeadFollowUp, LeadActivity } from '../../data/mockLeads';
import { MOCK_USERS } from '../../data/mockData';
import { convertLeadToEnquiry } from '../../utils/crmStore';

interface LeadDetailProps {
  lead: Lead;
  onBack: () => void;
  onUpdate: (lead: Lead) => void;
}

const LEAD_STAGES: { status: LeadStatus; label: string; desc: string }[] = [
  { status: 'New', label: 'New', desc: 'Awaiting initial contact' },
  { status: 'Contacted', label: 'Contacted', desc: 'In discovery / call' },
  { status: 'Qualified', label: 'Qualified', desc: 'Requirement confirmed' },
  { status: 'Converted', label: 'Converted', desc: 'Converted to Enquiry' },
];

export function LeadDetail({ lead, onBack, onUpdate }: LeadDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState<Lead>(lead);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [convertedEnquiryNum, setConvertedEnquiryNum] = useState<string | null>(null);

  // Handlers for updating lead locally and pushing up
  const saveLead = (updatedLead: Lead) => {
    setEditedLead(updatedLead);
    onUpdate(updatedLead);
  };

  const handleEditChange = (field: keyof Lead, value: any) => {
    setEditedLead(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = () => {
    saveLead(editedLead);
    setIsEditing(false);
  };

  const handleStatusChange = (status: LeadStatus) => {
    if (status === 'Converted') {
      setShowConvertModal(true);
      return;
    }

    const updated = {
      ...editedLead,
      status,
      activities: [
        {
          id: Date.now(),
          date: new Date().toISOString(),
          type: 'System' as const,
          description: `Status changed to ${status}`,
          performedBy: 'Current User'
        },
        ...(editedLead.activities || [])
      ]
    };
    saveLead(updated);
    setShowStatusModal(false);
  };

  const handleConvertLead = () => {
    const res = convertLeadToEnquiry(editedLead.id);
    if (res) {
      setEditedLead(res.lead);
      onUpdate(res.lead);
      setConvertedEnquiryNum(res.enquiry.enquiryNumber);
    }
    setShowConvertModal(false);
  };

  const handleGoToEnquiries = () => {
    window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
      detail: { workspace: 'Home', page: 'Enquiry' }
    }));
  };

  const handleAddActivity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as any;
    const description = formData.get('description') as string;
    
    const newActivity: LeadActivity = {
      id: Date.now(),
      date: new Date().toISOString(),
      type,
      description,
      performedBy: 'Current User'
    };
    
    saveLead({
      ...editedLead,
      activities: [newActivity, ...(editedLead.activities || [])]
    });
    setShowActivityModal(false);
  };

  const handleAddSchedule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as any;
    const remarks = formData.get('remarks') as string;
    const date = formData.get('date') as string;
    const time = formData.get('time') as string;
    
    const dateTime = new Date(`${date}T${time}`).toISOString();
    
    const newFollowUp: LeadFollowUp = {
      id: Date.now(),
      date: dateTime,
      type,
      remarks,
      status: 'Pending'
    };
    
    saveLead({
      ...editedLead,
      followUps: [newFollowUp, ...(editedLead.followUps || [])]
    });
    setShowScheduleModal(false);
  };

  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case 'New': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Contacted': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Qualified': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Unqualified': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Converted': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Lost': return 'bg-neutral-100 text-neutral-700 border-neutral-300';
      default: return 'bg-neutral-50 text-neutral-700 border-neutral-200';
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
      {/* Top Bar with Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2.5 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600 bg-white shadow-sm border border-neutral-200"
            title="Back to Leads list"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-[#1a1a1a]">{editedLead.companyName}</h1>
              
              {/* Interactive Status Selector Dropdown directly in Header */}
              <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-full px-3 py-1 shadow-sm">
                <span className="text-xs text-neutral-400 font-medium">Status:</span>
                <select
                  value={editedLead.status}
                  onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                  className={`text-xs font-bold bg-transparent focus:outline-none cursor-pointer rounded-full ${getStatusColor(editedLead.status)} px-2 py-0.5 border-0`}
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Converted">Converted (Enquiry)</option>
                  <option value="Unqualified">Unqualified</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>
            </div>
            <p className="text-neutral-500 mt-1 text-xs">
              {editedLead.leadNumber} • Created {new Date(editedLead.createdDate).toLocaleDateString()} • Assigned to <span className="font-semibold text-neutral-800">{editedLead.assignedTo}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-full font-semibold text-xs hover:bg-neutral-50 transition-colors shadow-sm"
          >
            {isEditing ? 'Cancel Edit' : 'Edit Lead'}
          </button>
          
          {editedLead.status !== 'Converted' && (
            <button 
              onClick={() => setShowConvertModal(true)}
              className="px-5 py-2 bg-[#1a1a1a] text-white rounded-full font-semibold text-xs hover:bg-black transition-all flex items-center gap-2 shadow-sm"
            >
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Convert to Enquiry</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Banner if converted */}
      {convertedEnquiryNum && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h4 className="font-bold text-emerald-900 text-sm">Lead Converted Successfully!</h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                New Enquiry <strong className="font-mono">{convertedEnquiryNum}</strong> has been generated for {editedLead.companyName}.
              </p>
            </div>
          </div>
          <button 
            onClick={handleGoToEnquiries}
            className="px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-semibold hover:bg-emerald-700 transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            <span>View Enquiry Module</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      {/* Stage Progression Stepper Bar */}
      <GlassCard intensity="light" className="p-4 md:p-5 border border-neutral-200/80">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Sparkles size={14} className="text-blue-600" /> Lead Lifecycle Stage Tracker
          </span>
          <span className="text-xs text-neutral-400 font-medium">Click any stage to update lead status</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {LEAD_STAGES.map((s, idx) => {
            const isCurrent = editedLead.status === s.status;
            const isConverted = editedLead.status === 'Converted';
            const isCompleted = (s.status === 'New' && ['Contacted', 'Qualified', 'Converted'].includes(editedLead.status)) ||
                                (s.status === 'Contacted' && ['Qualified', 'Converted'].includes(editedLead.status)) ||
                                (s.status === 'Qualified' && editedLead.status === 'Converted');

            return (
              <button
                key={s.status}
                onClick={() => handleStatusChange(s.status)}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${
                  isCurrent 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30' 
                    : isCompleted
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    isCurrent ? 'text-blue-100' : isCompleted ? 'text-emerald-600' : 'text-neutral-400'
                  }`}>
                    Stage 0{idx + 1}
                  </span>
                  {isCurrent && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
                  {isCompleted && <CheckCircle2 size={14} className="text-emerald-600" />}
                </div>
                <span className="font-bold text-sm">{s.label}</span>
                <span className={`text-[11px] mt-0.5 ${
                  isCurrent ? 'text-blue-100' : isCompleted ? 'text-emerald-700' : 'text-neutral-400'
                }`}>
                  {s.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dropouts / Negative Status handle */}
        {(editedLead.status === 'Unqualified' || editedLead.status === 'Lost') && (
          <div className="mt-3 pt-3 border-t border-neutral-200/60 flex items-center justify-between bg-rose-50/60 p-3 rounded-xl border border-rose-200/60 text-xs">
            <div className="flex items-center gap-2 text-rose-800 font-semibold">
              <AlertCircle size={16} />
              <span>Lead is marked as <strong>{editedLead.status}</strong></span>
            </div>
            <button
              onClick={() => handleStatusChange('Contacted')}
              className="text-xs text-rose-700 underline font-semibold hover:text-rose-900"
            >
              Re-open Lead
            </button>
          </div>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Overview Info */}
          <GlassCard intensity="light" className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-neutral-900">Lead Information</h3>
              {isEditing && (
                <button onClick={handleSaveEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] text-white rounded-full text-xs font-semibold hover:bg-black transition-colors shadow-sm">
                  <Save size={14} /> Save Changes
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs text-neutral-500 font-medium">Contact Person</label>
                {isEditing ? (
                  <div className="mt-1 space-y-2">
                    <input 
                      className="w-full bg-white/50 border border-neutral-200/60 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" 
                      value={editedLead.contactPerson} 
                      onChange={(e) => handleEditChange('contactPerson', e.target.value)} 
                    />
                    <input 
                      className="w-full bg-white/50 border border-neutral-200/60 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" 
                      value={editedLead.designation} 
                      onChange={(e) => handleEditChange('designation', e.target.value)} 
                    />
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-neutral-900 mt-1">{editedLead.contactPerson}</p>
                    <p className="text-sm text-neutral-600">{editedLead.designation}</p>
                  </>
                )}
              </div>
              
              <div>
                <label className="text-xs text-neutral-500 font-medium">Contact Details</label>
                {isEditing ? (
                  <div className="mt-1 space-y-2">
                    <input 
                      className="w-full bg-white/50 border border-neutral-200/60 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" 
                      value={editedLead.mobileNumber} 
                      onChange={(e) => handleEditChange('mobileNumber', e.target.value)} 
                    />
                    <input 
                      className="w-full bg-white/50 border border-neutral-200/60 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" 
                      value={editedLead.emailAddress} 
                      onChange={(e) => handleEditChange('emailAddress', e.target.value)} 
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone size={14} className="text-neutral-400" />
                      <span className="text-sm text-neutral-900">{editedLead.mobileNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail size={14} className="text-neutral-400" />
                      <span className="text-sm text-neutral-900">{editedLead.emailAddress}</span>
                    </div>
                  </>
                )}
              </div>
              
              <div>
                <label className="text-xs text-neutral-500 font-medium">Location</label>
                {isEditing ? (
                  <div className="mt-1 space-y-2">
                    <input 
                      className="w-full bg-white/50 border border-neutral-200/60 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" 
                      value={editedLead.city} 
                      onChange={(e) => handleEditChange('city', e.target.value)} 
                      placeholder="City"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin size={14} className="text-neutral-400" />
                    <span className="text-sm text-neutral-900">{editedLead.city}, {editedLead.state}, {editedLead.country}</span>
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-xs text-neutral-500 font-medium">Source & Industry</label>
                {isEditing ? (
                  <div className="mt-1 space-y-2">
                    <select 
                      className="w-full bg-white/50 border border-neutral-200/60 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" 
                      value={editedLead.industry} 
                      onChange={(e) => handleEditChange('industry', e.target.value)}
                    >
                      <option>Manufacturing</option>
                      <option>Pharmaceuticals</option>
                      <option>Water Treatment</option>
                      <option>Food & Beverage</option>
                      <option>Other</option>
                    </select>
                    <select 
                      className="w-full bg-white/50 border border-neutral-200/60 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" 
                      value={editedLead.leadSource} 
                      onChange={(e) => handleEditChange('leadSource', e.target.value)}
                    >
                      <option>Website</option>
                      <option>Trade Fair / Exhibition</option>
                      <option>Cold Call</option>
                      <option>Reference</option>
                      <option>LinkedIn</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-neutral-900 mt-1 font-medium">{editedLead.industry}</p>
                    <p className="text-sm text-neutral-600">Source: {editedLead.leadSource}</p>
                  </>
                )}
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-neutral-200/50">
              <label className="text-xs text-neutral-500 font-medium">Description</label>
              {isEditing ? (
                <textarea 
                  className="w-full mt-1.5 bg-white/50 border border-neutral-200/60 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 min-h-[80px]" 
                  value={editedLead.leadDescription} 
                  onChange={(e) => handleEditChange('leadDescription', e.target.value)} 
                />
              ) : (
                <p className="text-sm text-neutral-800 mt-1.5 leading-relaxed whitespace-pre-wrap">{editedLead.leadDescription}</p>
              )}
            </div>
          </GlassCard>

          {/* Activities & Timeline */}
          <GlassCard intensity="light" className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-neutral-900">Activity Timeline</h3>
              <button onClick={() => setShowActivityModal(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Add Activity</button>
            </div>
            <div className="relative pl-6 border-l-2 border-neutral-200 space-y-6">
              {(editedLead.activities || []).map((act) => (
                <div key={act.id} className="relative">
                  <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 text-sm">{act.type}</span>
                      <span className="text-xs text-neutral-500">• {new Date(act.date).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1 whitespace-pre-wrap">{act.description}</p>
                    <span className="text-xs text-neutral-400 mt-1">by {act.performedBy}</span>
                  </div>
                </div>
              ))}
              {(!editedLead.activities || editedLead.activities.length === 0) && (
                <p className="text-sm text-neutral-500 italic">No activities recorded yet.</p>
              )}
            </div>
          </GlassCard>
        </div>

        <div className="flex flex-col gap-6">
          {/* Qualification */}
          <GlassCard intensity="light" className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-neutral-900">Qualification</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-200/50 last:border-0 last:pb-0">
                <span className="text-sm text-neutral-600">Budget Available</span>
                {isEditing ? (
                  <select 
                    value={editedLead.budgetAvailable || ''} 
                    onChange={e => handleEditChange('budgetAvailable', e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">Unknown</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                  <span className="text-sm font-semibold text-neutral-900">{editedLead.budgetAvailable || '-'}</span>
                )}
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-neutral-200/50 last:border-0 last:pb-0">
                <span className="text-sm text-neutral-600">Decision Maker</span>
                {isEditing ? (
                  <select 
                    value={editedLead.decisionMakerIdentified || ''} 
                    onChange={e => handleEditChange('decisionMakerIdentified', e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">Unknown</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                  <span className="text-sm font-semibold text-neutral-900">{editedLead.decisionMakerIdentified || '-'}</span>
                )}
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-neutral-200/50 last:border-0 last:pb-0">
                <span className="text-sm text-neutral-600">Potential Value</span>
                {isEditing ? (
                  <input 
                    type="number"
                    value={editedLead.potentialBusinessValue || ''} 
                    onChange={e => handleEditChange('potentialBusinessValue', Number(e.target.value))}
                    className="text-sm border rounded px-2 py-1 w-24 text-right"
                  />
                ) : (
                  <span className="text-sm font-semibold text-neutral-900">₹{editedLead.potentialBusinessValue?.toLocaleString() || '0'}</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-600">Assigned To</span>
                {isEditing ? (
                  <select 
                    value={editedLead.assignedTo || ''} 
                    onChange={e => handleEditChange('assignedTo', e.target.value)}
                    className="text-sm border rounded px-2 py-1 bg-white font-medium text-neutral-800"
                  >
                    {MOCK_USERS.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-semibold text-neutral-900">{editedLead.assignedTo}</span>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Follow-ups */}
          <GlassCard intensity="light" className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-neutral-900">Upcoming Follow-ups</h3>
              <button onClick={() => setShowScheduleModal(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Schedule</button>
            </div>
            <div className="space-y-3">
              {(editedLead.followUps || []).filter(f => f.status === 'Pending').length > 0 ? (
                (editedLead.followUps || []).filter(f => f.status === 'Pending').map(f => (
                  <div key={f.id} className="p-3 bg-white/60 rounded-xl border border-neutral-200/60 shadow-sm relative group">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-neutral-900">{f.type}</span>
                      <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                        {new Date(f.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1.5">{f.remarks}</p>
                    <button 
                      onClick={() => {
                        saveLead({
                          ...editedLead,
                          followUps: (editedLead.followUps || []).map(fu => fu.id === f.id ? { ...fu, status: 'Completed' } : fu)
                        });
                      }}
                      className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      <CheckCircle2 size={12} /> Mark Completed
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500 italic text-center py-4">No pending follow-ups</p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Modals */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-neutral-100">
              <h3 className="font-bold text-neutral-900">Update Lead Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {['New', 'Contacted', 'Qualified', 'Unqualified', 'Lost'].map(status => (
                <button 
                  key={status}
                  onClick={() => handleStatusChange(status as LeadStatus)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    editedLead.status === status 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' 
                      : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-neutral-100">
              <h3 className="font-bold text-neutral-900">Convert Lead to Enquiry</h3>
              <button onClick={() => setShowConvertModal(false)} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleConvertLead(); }} className="p-6 flex flex-col gap-4">
              <p className="text-sm text-neutral-600">
                Are you sure you want to convert this lead from <strong>{editedLead.companyName}</strong> to an Enquiry? This will generate a new Enquiry record.
              </p>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowConvertModal(false)} className="px-4 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-full font-medium hover:bg-neutral-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-full font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2">
                  <CheckCircle2 size={16} /> Confirm Conversion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-neutral-100">
              <h3 className="font-bold text-neutral-900">Add Activity</h3>
              <button onClick={() => setShowActivityModal(false)} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddActivity} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-neutral-900">Activity Type</label>
                <select name="type" required className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  <option>Phone Call</option>
                  <option>Email</option>
                  <option>Meeting</option>
                  <option>Site Visit</option>
                  <option>WhatsApp Conversation</option>
                  <option>Add Note</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-neutral-900">Description / Notes</label>
                <textarea name="description" required rows={3} className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 placeholder:text-neutral-400" placeholder="E.g., Discussed pricing for 500 units..."></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowActivityModal(false)} className="px-4 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-full font-medium hover:bg-neutral-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#1a1a1a] text-white rounded-full font-semibold hover:bg-black transition-colors">Add Activity</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-neutral-100">
              <h3 className="font-bold text-neutral-900">Schedule Follow-up</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSchedule} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-neutral-900">Follow-up Type</label>
                <select name="type" required className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  <option>Phone Call</option>
                  <option>Email</option>
                  <option>Meeting</option>
                  <option>Site Visit</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-neutral-900">Date</label>
                  <input type="date" name="date" required className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-neutral-900">Time</label>
                  <input type="time" name="time" required className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-neutral-900">Remarks / Objective</label>
                <textarea name="remarks" required rows={2} className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 placeholder:text-neutral-400" placeholder="E.g., Call to check if proposal was reviewed"></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-full font-medium hover:bg-neutral-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#1a1a1a] text-white rounded-full font-semibold hover:bg-black transition-colors">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
