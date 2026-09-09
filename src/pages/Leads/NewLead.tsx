import React, { useState } from 'react';
import { ArrowLeft, Building2, User, Phone, Mail, MapPin, IndianRupee, Briefcase, Package, UserCheck } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';
import { MOCK_PARTNERS, MOCK_USERS, MOCK_PRODUCTS } from '../../data/mockData';
import { LeadStatus } from '../../data/mockLeads';

export function NewLead({ onBack, onSave }: { onBack: () => void, onSave: (leadData: any) => void }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | 'NEW' | ''>('');
  const [companyName, setCompanyName] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<number | 'NEW' | ''>('');
  const [contactPerson, setContactPerson] = useState('');
  const [designation, setDesignation] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [industry, setIndustry] = useState('Manufacturing');
  const [leadSource, setLeadSource] = useState('Website');
  const [assignedTo, setAssignedTo] = useState(MOCK_USERS[0]?.name || 'Shakir Pathan');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [potentialValue, setPotentialValue] = useState<string>('');
  const [description, setDescription] = useState('');
  
  const selectedCompany = MOCK_PARTNERS.find(p => p.id === Number(selectedCompanyId));

  const handleCompanySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'NEW') {
      setSelectedCompanyId('NEW');
      setCompanyName('');
      setCity('');
      setState('Maharashtra');
      setIndustry('Manufacturing');
      setSelectedContactId('');
      setContactPerson('');
      setDesignation('');
      setMobileNumber('');
      setEmailAddress('');
    } else if (val) {
      const compId = Number(val);
      setSelectedCompanyId(compId);
      const comp = MOCK_PARTNERS.find(p => p.id === compId);
      if (comp) {
        setCompanyName(comp.name);
        setIndustry(comp.industry || 'Manufacturing');
        setCity(comp.city || '');
        if (comp.phone) setMobileNumber(comp.phone);
        if (comp.email) setEmailAddress(comp.email);
        
        // Auto select primary contact if available
        const primary = comp.contacts?.find(c => c.isPrimary) || comp.contacts?.[0];
        if (primary) {
          setSelectedContactId(primary.id);
          setContactPerson(primary.name);
          setDesignation(primary.designation);
          setMobileNumber(primary.phone);
          setEmailAddress(primary.email);
        } else {
          setSelectedContactId('');
          setContactPerson('');
          setDesignation('');
        }
      }
    } else {
      setSelectedCompanyId('');
      setCompanyName('');
      setSelectedContactId('');
      setContactPerson('');
      setDesignation('');
      setMobileNumber('');
      setEmailAddress('');
    }
  };

  const handleContactSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'NEW') {
      setSelectedContactId('NEW');
      setContactPerson('');
      setDesignation('');
      setMobileNumber('');
      setEmailAddress('');
    } else if (val && selectedCompany) {
      const cId = Number(val);
      setSelectedContactId(cId);
      const contact = selectedCompany.contacts?.find(c => c.id === cId);
      if (contact) {
        setContactPerson(contact.name);
        setDesignation(contact.designation);
        setMobileNumber(contact.phone);
        setEmailAddress(contact.email);
      }
    } else {
      setSelectedContactId('');
      setContactPerson('');
      setDesignation('');
      setMobileNumber('');
      setEmailAddress('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) {
      alert('Please enter or select a Company Name');
      return;
    }
    if (!contactPerson) {
      alert('Please enter or select a Contact Person');
      return;
    }

    const interestedProducts = selectedProductId ? [{ productId: Number(selectedProductId), quantity: 100 }] : [];

    onSave({
      leadNumber: `LD-2026-${String(Math.floor(100 + Math.random() * 900))}`,
      companyName,
      companyId: typeof selectedCompanyId === 'number' ? selectedCompanyId : undefined,
      contactPerson,
      designation: designation || 'Manager',
      mobileNumber: mobileNumber || '+91 9876543210',
      emailAddress: emailAddress || 'contact@example.com',
      city: city || 'Pune',
      state: state || 'Maharashtra',
      country: 'India',
      industry,
      leadSource,
      interestedProducts,
      leadDescription: description || 'New inquiry regarding chemical/filter supplies.',
      assignedTo,
      createdDate: new Date().toISOString(),
      status: 'New' as LeadStatus,
      budgetAvailable: 'Yes',
      decisionMakerIdentified: 'Yes',
      requirementIdentified: 'Yes',
      potentialBusinessValue: potentialValue ? Number(potentialValue) : 50000,
      leadScore: 75,
      followUps: [],
      activities: [
        {
          id: Date.now(),
          date: new Date().toISOString(),
          type: 'System',
          description: 'Lead Created manually',
          performedBy: assignedTo
        }
      ]
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-neutral-200 rounded-full transition-colors text-neutral-500 bg-white shadow-sm border border-neutral-200"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#1a1a1a]">Create New Lead</h1>
          <p className="text-neutral-500 mt-1 text-sm">Fill in lead details using existing Business Partners & Users.</p>
        </div>
      </div>

      <GlassCard intensity="light" className="p-6 md:p-8">
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          
          {/* Company & Contact Selection */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-[#1a1a1a] pb-2 border-b border-neutral-200/60 flex items-center gap-2">
              <Building2 size={18} className="text-blue-600" /> Company & Contact Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Business Partner Select */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Business Partner (Company) *</label>
                <select
                  value={selectedCompanyId}
                  onChange={handleCompanySelect}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
                >
                  <option value="">-- Select Existing Business Partner --</option>
                  {MOCK_PARTNERS.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} ({comp.city || comp.type})
                    </option>
                  ))}
                  <option value="NEW">+ Create Custom New Company</option>
                </select>
              </div>

              {/* Company Name if NEW */}
              {selectedCompanyId === 'NEW' && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-neutral-700">Company Name *</label>
                  <input 
                    required 
                    type="text" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" 
                    placeholder="e.g. Acme Chemical Industries" 
                  />
                </div>
              )}

              {/* Contact Person Select */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Contact Person *</label>
                {selectedCompany ? (
                  <select
                    value={selectedContactId}
                    onChange={handleContactSelect}
                    className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
                  >
                    <option value="">-- Select Contact from {selectedCompany.name} --</option>
                    {selectedCompany.contacts?.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} - {contact.designation}
                      </option>
                    ))}
                    <option value="NEW">+ Add New Contact Person</option>
                  </select>
                ) : (
                  <input 
                    required 
                    type="text" 
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" 
                    placeholder="e.g. Rajesh Patil" 
                  />
                )}
              </div>

              {/* Contact Name if NEW */}
              {selectedContactId === 'NEW' && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-neutral-700">New Contact Name *</label>
                  <input 
                    required 
                    type="text" 
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" 
                    placeholder="e.g. Rajesh Patil" 
                  />
                </div>
              )}

              {/* Designation */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Designation</label>
                <input 
                  type="text" 
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" 
                  placeholder="e.g. Purchase Manager" 
                />
              </div>

              {/* Mobile */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Mobile Number</label>
                <input 
                  type="tel" 
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" 
                  placeholder="+91 9876543210" 
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Email Address</label>
                <input 
                  type="email" 
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" 
                  placeholder="contact@company.com" 
                />
              </div>

              {/* City */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">City</label>
                <input 
                  type="text" 
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" 
                  placeholder="e.g. Pune" 
                />
              </div>
            </div>
          </div>

          {/* Lead Qualification & Ownership */}
          <div className="space-y-4 pt-2">
            <h3 className="text-base font-bold text-[#1a1a1a] pb-2 border-b border-neutral-200/60 flex items-center gap-2">
              <UserCheck size={18} className="text-blue-600" /> Assignment & Requirement Info
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assigned To - populated from MOCK_USERS */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Assigned To (Sales User) *</label>
                <select 
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold text-neutral-800"
                >
                  {MOCK_USERS.map(user => (
                    <option key={user.id} value={user.name}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Industry */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Industry</label>
                <select 
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Pharmaceuticals">Pharmaceuticals</option>
                  <option value="Water Treatment">Water Treatment</option>
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="Agriculture">Agriculture</option>
                  <option value="Energy">Energy</option>
                  <option value="Chemicals">Chemicals</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Lead Source */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Lead Source</label>
                <select 
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value as any)}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="Website">Website</option>
                  <option value="Trade Fair / Exhibition">Trade Fair / Exhibition</option>
                  <option value="Cold Call">Cold Call</option>
                  <option value="Reference">Reference</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Email Campaign">Email Campaign</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Existing Customer">Existing Customer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Primary Product Interest */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Interested Product</label>
                <select 
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="">-- Select Product Interest --</option>
                  {MOCK_PRODUCTS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Potential Business Value */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700">Potential Business Value (₹)</label>
                <input 
                  type="number" 
                  value={potentialValue}
                  onChange={(e) => setPotentialValue(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" 
                  placeholder="e.g. 150000" 
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2 pt-2">
              <label className="text-xs font-semibold text-neutral-700">Requirement Description & Notes</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm min-h-[100px]" 
                placeholder="Details about client requirements, technical specifications, quantities..."
              ></textarea>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-neutral-200/50">
            <button 
              type="button" 
              onClick={onBack} 
              className="px-6 py-2.5 bg-white rounded-full border border-neutral-200 shadow-sm text-neutral-700 hover:bg-neutral-50 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-6 py-2.5 bg-[#1a1a1a] text-white rounded-full shadow-lg hover:bg-black transition-colors font-semibold text-sm flex items-center gap-2"
            >
              Save Lead
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
