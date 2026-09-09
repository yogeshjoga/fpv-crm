import React, { useState } from 'react';
import { ArrowLeft, Edit2, Mail, Phone, MapPin, Building2, Globe, Users, Plus, User, FileText, CheckCircle2, X } from 'lucide-react';
import { GlassCard, IconButton } from '../../components/ui/shared';
import { MOCK_PARTNERS, Contact } from '../../data/mockData';

export function BusinessPartnerDetail({ partnerId, onBack }: { partnerId: number, onBack: () => void }) {
  // Find partner from mock data
  const partnerData = MOCK_PARTNERS.find(p => p.id === partnerId);
  const [localContacts, setLocalContacts] = useState<Contact[]>(partnerData?.contacts || []);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    designation: '',
    department: '',
    email: '',
    phone: '',
    isPrimary: false
  });

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.email) return;

    const addedContact: Contact = {
      id: Date.now(),
      name: newContact.name,
      designation: newContact.designation,
      department: newContact.department,
      email: newContact.email,
      phone: newContact.phone,
      isPrimary: newContact.isPrimary
    };

    const updatedContacts = [...localContacts, addedContact];
    setLocalContacts(updatedContacts);
    
    // Update mock data directly so it persists while app is running
    if (partnerData) {
      partnerData.contacts = updatedContacts;
    }

    setNewContact({ name: '', designation: '', department: '', email: '', phone: '', isPrimary: false });
    setIsAddContactOpen(false);
  };

  const partner = {
    name: partnerData?.name || 'Unknown',
    type: partnerData?.type || '-',
    industry: partnerData?.industry || '-',
    website: partnerData?.website || '-',
    email: partnerData?.email || '-',
    phone: partnerData?.phone || '-',
    address: partnerData?.address || '-',
    gst: partnerData?.gst || '-',
    category: partnerData?.category || '-',
    creditLimit: partnerData?.creditLimit || '-',
    paymentTerms: partnerData?.paymentTerms || '-',
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors shadow-sm text-neutral-600"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-display text-3xl font-bold text-[#1a1a1a]">{partner.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-neutral-500 font-medium">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">{partner.type}</span>
              <span>•</span>
              <span>{partner.industry}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-neutral-200 shadow-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
            <Edit2 size={16} />
            <span className="font-medium">Edit</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <GlassCard intensity="light" className="p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-neutral-500" />
              Company Details
            </h3>
            
            <div className="flex flex-col gap-4">
              <InfoRow label="Email" value={partner.email} icon={<Mail size={14} />} />
              <InfoRow label="Phone" value={partner.phone} icon={<Phone size={14} />} />
              <InfoRow label="Website" value={partner.website} icon={<Globe size={14} />} />
              <InfoRow label="Tax ID / GST" value={partner.gst} icon={<FileText size={14} />} />
              
              <div className="mt-2 pt-4 border-t border-neutral-200/50">
                <div className="text-xs text-neutral-500 font-medium mb-2 flex items-center gap-1.5"><MapPin size={14} /> Registered Address</div>
                <div className="text-sm text-neutral-800 whitespace-pre-line leading-relaxed">
                  {partner.address}
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard intensity="light" className="p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <FileText size={18} className="text-neutral-500" />
              Commercial Info
            </h3>
            
            <div className="flex flex-col gap-4">
              <InfoRow label="Category" value={partner.category} />
              <InfoRow label="Credit Limit" value={partner.creditLimit} />
              <InfoRow label="Payment Terms" value={partner.paymentTerms} />
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Contacts & Activity */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          <GlassCard intensity="light" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Users size={18} className="text-neutral-500" />
                Key Contacts
              </h3>
              <button 
                onClick={() => setIsAddContactOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] text-white rounded-full text-sm font-medium hover:bg-black transition-colors shadow-sm"
              >
                <Plus size={14} />
                Add Contact
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localContacts.length > 0 ? localContacts.map(contact => (
                <div key={contact.id} className="relative p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm flex flex-col gap-3 group hover:border-neutral-300 transition-colors">
                  {contact.isPrimary && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                      <CheckCircle2 size={12} />
                      Primary
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 font-semibold border border-neutral-200">
                      {contact.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#1a1a1a]">{contact.name}</h4>
                      <p className="text-xs text-neutral-500">{contact.designation} • {contact.department}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-100 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Mail size={14} className="text-neutral-400" />
                      {contact.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Phone size={14} className="text-neutral-400" />
                      {contact.phone}
                    </div>
                  </div>
                  
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors">
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-8 text-center text-neutral-500 text-sm">
                  No contacts added yet.
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {isAddContactOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <h3 className="text-lg font-bold text-[#1a1a1a]">Add New Contact</h3>
              <button 
                onClick={() => setIsAddContactOpen(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-500"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddContact} className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Full Name *</label>
                  <input 
                    required
                    type="text" 
                    value={newContact.name}
                    onChange={e => setNewContact({...newContact, name: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" 
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Designation</label>
                  <input 
                    type="text" 
                    value={newContact.designation}
                    onChange={e => setNewContact({...newContact, designation: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" 
                    placeholder="e.g. Manager"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Department</label>
                  <input 
                    type="text" 
                    value={newContact.department}
                    onChange={e => setNewContact({...newContact, department: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" 
                    placeholder="e.g. Sales"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Email Address *</label>
                  <input 
                    required
                    type="email" 
                    value={newContact.email}
                    onChange={e => setNewContact({...newContact, email: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" 
                    placeholder="email@example.com"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Phone Number</label>
                  <input 
                    type="tel" 
                    value={newContact.phone}
                    onChange={e => setNewContact({...newContact, phone: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" 
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2 mt-2">
                  <input 
                    type="checkbox" 
                    id="isPrimary"
                    checked={newContact.isPrimary}
                    onChange={e => setNewContact({...newContact, isPrimary: e.target.checked})}
                    className="w-4 h-4 rounded border-neutral-300 text-[#1a1a1a] focus:ring-[#1a1a1a]"
                  />
                  <label htmlFor="isPrimary" className="text-sm font-medium text-neutral-700 cursor-pointer">
                    Set as primary contact
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 mt-2">
                <button 
                  type="button"
                  onClick={() => setIsAddContactOpen(false)}
                  className="px-5 py-2.5 rounded-full text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 rounded-full text-sm font-medium bg-[#1a1a1a] text-white hover:bg-black transition-colors"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string, value: string, icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {icon && <div className="w-5 h-5 flex items-center justify-center text-neutral-400">{icon}</div>}
      <div className={!icon ? "pl-0" : ""}>
        <div className="text-xs text-neutral-500 font-medium">{label}</div>
        <div className="text-[14px] font-medium text-neutral-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}
