import React, { useState, useMemo } from 'react';
import { 
  Settings, Users as UsersIcon, Plus, Trash2, Edit3, Shield, User, Search, Mail, Bell, 
  CheckCircle2, X, Database, Lock, Save, ShieldCheck, ChevronDown, Filter, Users
} from 'lucide-react';
import { MOCK_USERS, AppUser } from '../data/mockData';
import { GlassCard } from '../components/ui/shared';
import { Pagination } from '../components/ui/Pagination';

export function Administrator() {
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [users, setUsers] = useState<AppUser[]>(MOCK_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Admin' | 'User'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  
  // Modal states
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<AppUser>>({ role: 'User', status: 'Active' });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'All' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Reset page on filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  // Paginated users
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  // Handlers
  const handleDeleteUser = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete operator "${name}"?`)) {
      setUsers(prev => prev.filter(u => u.id !== id));
      showToast(`Operator "${name}" removed successfully.`);
    }
  };

  const handleToggleUserStatus = (id: number) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const newStatus = u.status === 'Active' ? 'Inactive' : 'Active';
        showToast(`Operator ${u.name} is now ${newStatus}.`);
        return { ...u, status: newStatus };
      }
      return u;
    }));
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name || !userFormData.email) return;

    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userFormData } as AppUser : u));
      showToast(`Operator "${userFormData.name}" updated successfully.`);
    } else {
      const newUserObj: AppUser = {
        id: Date.now(),
        name: userFormData.name,
        email: userFormData.email,
        role: (userFormData.role as 'Admin' | 'User') || 'User',
        status: (userFormData.status as 'Active' | 'Inactive') || 'Active'
      };
      setUsers(prev => [newUserObj, ...prev]);
      showToast(`New operator "${newUserObj.name}" added successfully.`);
    }

    setIsAddingUser(false);
    setEditingUser(null);
    setUserFormData({ role: 'User', status: 'Active' });
  };

  const openEditModal = (user: AppUser) => {
    setEditingUser(user);
    setUserFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    });
    setIsAddingUser(true);
  };

  // Settings State
  const [settings, setSettings] = useState({
    companyName: 'SP Water & Chemicals CRM',
    timezone: 'Asia/Kolkata (IST)',
    currency: '₹ INR',
    dateFormat: 'YYYY-MM-DD',
    emailNotifications: true,
    taskReminders: true,
    quoteFollowups: true,
    security2FA: true,
    autoBackup: true,
    sessionTimeout: '30'
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('System configuration & policy preferences updated.');
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[120] bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-3 duration-200 border border-neutral-700">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Title and Segmented Workspace Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200/60">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Administration</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage system operators, role permissions, and global workspace configuration.
          </p>
        </div>

        {/* Segmented Tab Selector Pills */}
        <div className="bg-neutral-200/60 p-1 rounded-2xl border border-neutral-200/80 inline-flex items-center gap-1 shrink-0 self-start sm:self-auto shadow-2xs">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
            }`}
          >
            <UsersIcon size={14} /> 
            <span>User Management</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
              activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-neutral-300/80 text-neutral-700'
            }`}>
              {users.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
            }`}
          >
            <Settings size={14} /> 
            <span>System Settings</span>
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="flex flex-col gap-6">
          {/* Custom Search, Filter Dropdowns & Add Button Bar */}
          <GlassCard intensity="light" className="p-3 border border-white/80 shadow-xs rounded-2xl">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              
              {/* Left Group: Search & Custom Dropdowns */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 flex-1">
                {/* Search Box */}
                <div className="relative w-full sm:w-80 group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" size={15} />
                  <input 
                    type="text" 
                    placeholder="Search operator name or email..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9.5 pr-8 py-2 bg-neutral-50/90 focus:bg-white border border-neutral-200/90 focus:border-neutral-900 rounded-xl text-xs font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all shadow-2xs"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5 rounded-md hover:bg-neutral-200/60 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Custom Role Filter Dropdown */}
                  <div className="relative w-full sm:w-40 group">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-hover:text-neutral-600 pointer-events-none transition-colors" size={14} />
                    <select
                      value={roleFilter}
                      onChange={e => setRoleFilter(e.target.value as any)}
                      className="w-full pl-8.5 pr-8 py-2 bg-neutral-50/90 hover:bg-white focus:bg-white border border-neutral-200/90 focus:border-neutral-900 rounded-xl text-xs font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none cursor-pointer transition-all shadow-2xs"
                    >
                      <option value="All">All Roles</option>
                      <option value="Admin">Admin</option>
                      <option value="User">Standard User</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" size={14} />
                  </div>

                  {/* Custom Status Filter Dropdown */}
                  <div className="relative w-full sm:w-40 group">
                    <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-hover:text-neutral-600 pointer-events-none transition-colors" size={14} />
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}
                      className="w-full pl-8.5 pr-8 py-2 bg-neutral-50/90 hover:bg-white focus:bg-white border border-neutral-200/90 focus:border-neutral-900 rounded-xl text-xs font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none cursor-pointer transition-all shadow-2xs"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" size={14} />
                  </div>

                  {/* Clear Filter Button */}
                  {(searchQuery || roleFilter !== 'All' || statusFilter !== 'All') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setRoleFilter('All');
                        setStatusFilter('All');
                      }}
                      title="Clear active filters"
                      className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      <X size={13} />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Add Operator Action Button */}
              <button 
                onClick={() => {
                  setEditingUser(null);
                  setUserFormData({ role: 'User', status: 'Active' });
                  setIsAddingUser(true);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow active:scale-95 shrink-0"
              >
                <Plus size={15} /> <span>Add Operator</span>
              </button>

            </div>
          </GlassCard>

          {/* Add / Edit Operator Modal Dialog */}
          {isAddingUser && (
            <div className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
              <div className="bg-white border border-neutral-200/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80">
                  <div>
                    <h3 className="font-bold text-neutral-900 text-base">
                      {editingUser ? 'Edit CRM Operator' : 'Add New Operator'}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Define account permissions and contact information</p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAddingUser(false);
                      setEditingUser(null);
                    }}
                    className="w-8 h-8 rounded-full bg-white hover:bg-neutral-100 border border-neutral-200/50 flex items-center justify-center text-neutral-500 hover:text-neutral-800 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={userFormData.name || ''}
                      onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-xl text-xs text-neutral-800 outline-none font-medium"
                      placeholder="e.g. Shakir Pathan"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={userFormData.email || ''}
                      onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-xl text-xs text-neutral-800 outline-none font-medium"
                      placeholder="e.g. shakir@spcrm.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Role Permission</label>
                      <select 
                        value={userFormData.role || 'User'}
                        onChange={e => setUserFormData({ ...userFormData, role: e.target.value as 'Admin' | 'User' })}
                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-xl text-xs text-neutral-800 outline-none font-medium"
                      >
                        <option value="User">User (Standard)</option>
                        <option value="Admin">Admin (Full Access)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-600 mb-1">Account Status</label>
                      <select 
                        value={userFormData.status || 'Active'}
                        onChange={e => setUserFormData({ ...userFormData, status: e.target.value as 'Active' | 'Inactive' })}
                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-xl text-xs text-neutral-800 outline-none font-medium"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-2 border-t border-neutral-100">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAddingUser(false);
                        setEditingUser(null);
                      }}
                      className="px-4 py-2.5 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl text-xs font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-5 py-2.5 bg-neutral-900 text-white hover:bg-black rounded-xl text-xs font-bold transition-all shadow-md"
                    >
                      {editingUser ? 'Update Operator' : 'Save Operator'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Main User Directory Table */}
          <div className="bg-white border border-neutral-200/80 rounded-[2rem] overflow-hidden shadow-sm">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-16 h-16 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center mb-4 text-neutral-400 shadow-2xs">
                  <UsersIcon size={26} />
                </div>
                <h3 className="font-bold text-base text-neutral-900">No Operators Found</h3>
                <p className="text-xs text-neutral-500 max-w-sm mt-1">
                  No system operators match your current filter criteria.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('All');
                    setStatusFilter('All');
                  }}
                  className="mt-4 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold rounded-xl text-xs transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-[11px] font-extrabold text-neutral-400 tracking-wider uppercase">
                        <th className="py-4 px-6">Operator Name & Email</th>
                        <th className="py-4 px-6">Role Permission</th>
                        <th className="py-4 px-6">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-xs">
                      {paginatedUsers.map(user => {
                        const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                        return (
                          <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center font-bold text-xs tracking-wider border border-neutral-200 shadow-2xs shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">
                                    {user.name}
                                  </p>
                                  <p className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5 font-medium">
                                    <Mail size={11} className="text-neutral-400" /> {user.email}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-6">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                                user.role === 'Admin'
                                  ? 'bg-purple-100/90 text-purple-800 border-purple-200/80'
                                  : 'bg-blue-100/90 text-blue-800 border-blue-200/80'
                              }`}>
                                {user.role === 'Admin' ? <Shield size={12} className="text-purple-600" /> : <User size={12} className="text-blue-600" />}
                                {user.role}
                              </span>
                            </td>

                            <td className="py-4 px-6">
                              <button
                                onClick={() => handleToggleUserStatus(user.id)}
                                title="Click to toggle status"
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                                  user.status === 'Active'
                                    ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200/80 hover:bg-emerald-200'
                                    : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-600' : 'bg-neutral-400'}`} />
                                {user.status}
                              </button>
                            </td>

                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={() => openEditModal(user)}
                                  title="Edit operator details"
                                  className="p-1.5 hover:bg-blue-50 rounded-lg text-neutral-500 hover:text-blue-600 transition-colors"
                                >
                                  <Edit3 size={15} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteUser(user.id, user.name)}
                                  title="Delete operator"
                                  className="p-1.5 hover:bg-rose-50 rounded-lg text-neutral-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-3 bg-neutral-50/50 border-t border-neutral-100">
                  <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={filteredUsers.length}
                    itemsPerPage={itemsPerPage}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* General Preferences Card */}
            <GlassCard intensity="light" className="p-6 flex flex-col justify-between gap-5 hover:border-neutral-300 transition-all">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center shrink-0">
                    <Settings size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm">General Preferences</h3>
                    <p className="text-[11px] text-neutral-500">Core CRM metadata & locale</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Company Name</label>
                    <input 
                      type="text" 
                      value={settings.companyName}
                      onChange={e => setSettings({ ...settings, companyName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-neutral-200/80 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">System Timezone</label>
                    <select 
                      value={settings.timezone}
                      onChange={e => setSettings({ ...settings, timezone: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-neutral-200/80 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      <option>Asia/Kolkata (IST)</option>
                      <option>UTC (Coordinated Universal Time)</option>
                      <option>America/New_York (EST)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Primary Currency</label>
                    <select 
                      value={settings.currency}
                      onChange={e => setSettings({ ...settings, currency: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-neutral-200/80 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      <option>₹ INR (Indian Rupee)</option>
                      <option>$ USD (US Dollar)</option>
                      <option>€ EUR (Euro)</option>
                    </select>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Notification Policy Card */}
            <GlassCard intensity="light" className="p-6 flex flex-col justify-between gap-5 hover:border-neutral-300 transition-all">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center shrink-0">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm">Notification Policies</h3>
                    <p className="text-[11px] text-neutral-500">Automated CRM email & alerts</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 border border-neutral-200/80 rounded-xl bg-white hover:bg-neutral-50 transition-colors cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">Email Summaries</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Daily deal dispatch summaries</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={settings.emailNotifications}
                      onChange={e => setSettings({ ...settings, emailNotifications: e.target.checked })}
                      className="w-4 h-4 rounded text-neutral-900 accent-neutral-900 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 border border-neutral-200/80 rounded-xl bg-white hover:bg-neutral-50 transition-colors cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">Task Reminders</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Overdue task notifications</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={settings.taskReminders}
                      onChange={e => setSettings({ ...settings, taskReminders: e.target.checked })}
                      className="w-4 h-4 rounded text-neutral-900 accent-neutral-900 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 border border-neutral-200/80 rounded-xl bg-white hover:bg-neutral-50 transition-colors cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">Quotation Followups</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Auto-remind pending offers</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={settings.quoteFollowups}
                      onChange={e => setSettings({ ...settings, quoteFollowups: e.target.checked })}
                      className="w-4 h-4 rounded text-neutral-900 accent-neutral-900 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </GlassCard>

            {/* Security & System Integrity Card */}
            <GlassCard intensity="light" className="p-6 flex flex-col justify-between gap-5 hover:border-neutral-300 transition-all md:col-span-2 lg:col-span-1">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm">Security & Audit</h3>
                    <p className="text-[11px] text-neutral-500">Access controls & data policy</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <label className="flex items-center justify-between p-3 border border-neutral-200/80 rounded-xl bg-white hover:bg-neutral-50 transition-colors cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">Enforce 2FA for Admins</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Two-factor authentication</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={settings.security2FA}
                      onChange={e => setSettings({ ...settings, security2FA: e.target.checked })}
                      className="w-4 h-4 rounded text-neutral-900 accent-neutral-900 cursor-pointer"
                    />
                  </label>

                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1">Session Inactivity Timeout</label>
                    <select 
                      value={settings.sessionTimeout}
                      onChange={e => setSettings({ ...settings, sessionTimeout: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-neutral-200/80 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      <option value="15">15 Minutes</option>
                      <option value="30">30 Minutes</option>
                      <option value="60">60 Minutes</option>
                    </select>
                  </div>

                  <div className="p-3 bg-neutral-100/70 border border-neutral-200/60 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                        <Database size={13} className="text-neutral-500" /> Database Backup
                      </p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">Automated daily snapshot at 02:00 IST</p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Global Configuration Save Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-black text-white rounded-2xl text-xs font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Save size={16} /> Save System Settings
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

