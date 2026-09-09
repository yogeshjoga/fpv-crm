import React, { useState } from 'react';
import { ArrowLeft, Building2, User, Save, FileText, Calendar, AlertCircle, Plus, Trash2, List, Type, Clock, Hash, IndianRupee } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';
import { MOCK_PARTNERS, MOCK_PRODUCTS, MOCK_USERS } from '../../data/mockData';
import { getEnquiries, saveEnquiries } from '../../utils/crmStore';

export function NewEnquiry({ onBack, onSave }: { onBack: () => void, onSave: () => void }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | 'NEW' | ''>('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<number | 'NEW' | ''>('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [title, setTitle] = useState('');
  const [enquiryDate, setEnquiryDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredByDate, setRequiredByDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [source, setSource] = useState('Email');
  const [assignedTo, setAssignedTo] = useState(MOCK_USERS[0]?.name || 'Shakir Pathan');
  const [description, setDescription] = useState('');
  
  const [items, setItems] = useState<{ id: number; productId?: number; product: string; quantity: number; unit: string; targetPrice: string; remarks: string; }[]>([{ id: 1, productId: undefined, product: '', quantity: 1, unit: 'Nos', targetPrice: '', remarks: '' }]);
  
  const selectedCompany = MOCK_PARTNERS.find(p => p.id === Number(selectedCompanyId));
  const contacts = selectedCompany?.contacts || [];

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), productId: undefined, product: '', quantity: 1, unit: 'Nos', targetPrice: '', remarks: '' }]);
  };

  const handleRemoveItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id: number, field: string, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSave = () => {
    if (!selectedCompanyId) {
      alert('Please select a Business Partner (Company)');
      return;
    }

    const currentEnquiries = getEnquiries();
    const newId = currentEnquiries.length > 0 ? Math.max(...currentEnquiries.map(e => e.id)) + 1 : 1;
    const randomEnqNum = `ENQ-2023-${String(Math.floor(Math.random() * 900) + 100)}`;

    const newEnq = {
      id: newId,
      enquiryNumber: randomEnqNum,
      title: title || `${selectedCompany?.name || 'Inquiry'} - Chemical Requirement`,
      date: enquiryDate,
      requiredByDate: requiredByDate || undefined,
      companyId: Number(selectedCompanyId),
      contactId: selectedContactId ? Number(selectedContactId) : undefined,
      priority,
      source,
      assignedTo,
      description,
      status: 'Open' as const,
      stage: 'New' as const,
      items: items.map(item => ({
        id: item.id,
        productId: item.productId,
        product: item.product || 'Custom Spares / Chemical Product',
        quantity: item.quantity,
        unit: item.unit,
        remarks: item.remarks
      })),
      createdBy: assignedTo || 'Shakir Pathan',
      lastUpdated: new Date().toISOString()
    };

    saveEnquiries([newEnq, ...currentEnquiries]);
    onSave();
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in zoom-in-95 duration-300 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-[#1a1a1a]">New Enquiry</h2>
            <p className="text-sm text-neutral-500">Create a new customer enquiry</p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1a1a] text-white rounded-xl text-sm font-medium hover:bg-black transition-colors shadow-sm"
        >
          <Save size={16} />
          Save Enquiry
        </button>
      </div>

      <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 pt-2 pb-10">
        
        {/* Section 1 - General Information */}
        <GlassCard intensity="light" className="p-6">
          <h3 className="font-semibold text-lg mb-6 flex items-center gap-2 border-b border-neutral-200/50 pb-3">
            <FileText size={18} className="text-neutral-500" />
            General Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
                <Type size={14} className="text-neutral-400" /> Enquiry Title *
              </label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Requirement for Project X" 
                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" 
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
                <Building2 size={14} className="text-neutral-400" /> Business Partner (Customer) *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select 
                  value={selectedCompanyId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCompanyId(val === 'NEW' ? 'NEW' : (val ? Number(val) : ''));
                    setSelectedContactId('');
                    if (val === 'NEW') {
                      setNewCompanyName('');
                    }
                  }}
                  className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                >
                  <option value="">Select a company...</option>
                  {MOCK_PARTNERS.map(partner => (
                    <option key={partner.id} value={partner.id}>{partner.name}</option>
                  ))}
                  <option value="NEW">+ Add New Company</option>
                </select>
                {selectedCompanyId === 'NEW' && (
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={e => setNewCompanyName(e.target.value)}
                    placeholder="Enter new company name..."
                    className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  />
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
                <User size={14} className="text-neutral-400" /> Contact Person *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select 
                  value={selectedContactId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedContactId(val === 'NEW' ? 'NEW' : (val ? Number(val) : ''));
                    if (val === 'NEW') {
                      setNewContactName('');
                      setNewContactEmail('');
                      setNewContactPhone('');
                    }
                  }}
                  disabled={!selectedCompanyId && selectedCompanyId !== 'NEW'}
                  className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  {!selectedCompanyId ? (
                    <option value="">Select company first</option>
                  ) : (
                    <>
                      <option value="">Select contact...</option>
                      {contacts.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      <option value="NEW">+ Add New Contact</option>
                    </>
                  )}
                </select>
                {selectedContactId === 'NEW' && (
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      required
                      value={newContactName}
                      onChange={e => setNewContactName(e.target.value)}
                      placeholder="Contact Name..."
                      className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="tel"
                        required
                        value={newContactPhone}
                        onChange={e => setNewContactPhone(e.target.value)}
                        placeholder="Phone..."
                        className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                      <input
                        type="email"
                        value={newContactEmail}
                        onChange={e => setNewContactEmail(e.target.value)}
                        placeholder="Email..."
                        className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
                <Calendar size={14} className="text-neutral-400" /> Enquiry Date
              </label>
              <input 
                type="date" 
                value={enquiryDate}
                onChange={(e) => setEnquiryDate(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
                <Clock size={14} className="text-neutral-400" /> Required By Date
              </label>
              <input 
                type="date" 
                value={requiredByDate}
                onChange={(e) => setRequiredByDate(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
                <AlertCircle size={14} className="text-neutral-400" /> Priority
              </label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
                <Hash size={14} className="text-neutral-400" /> Source
              </label>
              <select 
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              >
                <option value="Call">Call</option>
                <option value="Email">Email</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Website">Website</option>
                <option value="Reference">Reference</option>
                <option value="Visit">Visit</option>
                <option value="Existing Customer">Existing Customer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
                <User size={14} className="text-neutral-400" /> Sales Owner
              </label>
              <select 
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium text-neutral-800"
              >
                {MOCK_USERS.map(user => (
                  <option key={user.id} value={user.name}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-6">
            <label className="block text-sm font-semibold text-[#1a1a1a] mb-2 flex items-center gap-2">
              <FileText size={14} className="text-neutral-400" /> Description / Customer Requirement
            </label>
            <textarea 
              rows={4} 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about the customer's requirement..."
              className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
            ></textarea>
          </div>
        </GlassCard>

        {/* Section 2 - Products/Items */}
        <GlassCard intensity="light" className="p-6">
          <div className="flex items-center justify-between border-b border-neutral-200/50 pb-3 mb-6">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <List size={18} className="text-neutral-500" />
              Products / Items Required
            </h3>
            <button 
              onClick={handleAddItem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] text-white rounded-full text-xs font-semibold hover:bg-black transition-colors shadow-sm"
            >
              <Plus size={14} />
              Add Another Product
            </button>
          </div>
          
          <div className="flex flex-col gap-4">
            {items.map((item, index) => (
              <div key={item.id} className="flex flex-col gap-4 p-5 bg-neutral-50/80 border border-neutral-200 rounded-xl relative group">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                      {index + 1}
                    </div>
                    <span className="font-medium text-sm text-neutral-700">Product Line</span>
                  </div>
                  <button 
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={items.length === 1}
                    className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:hover:text-neutral-400 disabled:hover:bg-transparent transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Product Description *</label>
                    <select
                      value={item.productId || ''}
                      onChange={(e) => {
                        const prodId = parseInt(e.target.value);
                        const product = MOCK_PRODUCTS.find(p => p.id === prodId);
                        if (product) {
                          const newItems = items.map(i => i.id === item.id ? { ...i, productId: product.id, product: product.name, unit: product.unit } : i);
                          setItems(newItems);
                        } else {
                          handleItemChange(item.id, 'productId', undefined);
                          handleItemChange(item.id, 'product', '');
                        }
                      }}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    >
                      <option value="">Select a Product</option>
                      {MOCK_PRODUCTS.map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Quantity *</label>
                    <input 
                      type="number" 
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Unit</label>
                    <input 
                      type="text" 
                      value={item.unit}
                      onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                      placeholder="Nos"
                      className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                  
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Target Price (Opt)</label>
                    <div className="relative">
                      <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input 
                        type="number" 
                        value={item.targetPrice}
                        onChange={(e) => handleItemChange(item.id, 'targetPrice', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-neutral-300 rounded-lg pl-8 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-12">
                    <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Remarks (Opt)</label>
                    <input 
                      type="text" 
                      value={item.remarks}
                      onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)}
                      placeholder="Add any specific requirements for this product..."
                      className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

      </div>
    </div>
  );
}
