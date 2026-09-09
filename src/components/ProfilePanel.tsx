import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckSquare, 
  AtSign, 
  Clock, 
  ChevronRight, 
  ExternalLink, 
  User, 
  Building2, 
  Mail, 
  Phone, 
  MessageSquare,
  AlertCircle,
  TrendingUp,
  Award
} from 'lucide-react';
import { GlassCard } from './ui/shared';
import { getTasks, saveTasks, getEnquiries, Task } from '../utils/crmStore';
import { MOCK_PARTNERS } from '../data/mockData';

const MOCK_MENTIONS = [
  {
    id: 1,
    author: 'Yaseen Shaikh',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    content: '@Roop Raman please review the pricing for PP Melt Blown Cartridge 1 Micron in ENQ-2023-001',
    enquiryId: 1,
    time: '10 mins ago',
    unread: true
  },
  {
    id: 2,
    author: 'Admin User',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
    content: 'Urgent: @Roop Raman please call Godrej Agrovet regarding RO Antiscalant bulk order (ENQ-2023-002)',
    enquiryId: 2,
    time: '1 hour ago',
    unread: true
  },
  {
    id: 3,
    author: 'Sales Team A',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=100&q=80',
    content: '@Roop Raman uploaded the technical comparison document for Biltube Industries (ENQ-2023-003)',
    enquiryId: 3,
    time: '2 hours ago',
    unread: false
  }
];

export function ProfilePanel() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'reminders' | 'mentions'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);

  const loadData = () => {
    setTasks(getTasks());
    setEnquiries(getEnquiries());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('crm-store-update', loadData);
    return () => window.removeEventListener('crm-store-update', loadData);
  }, []);

  const handleToggleTask = (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Stop navigation click
    const allTasks = getTasks();
    const updated = allTasks.map(t => {
      if (t.id === taskId) {
        return { ...t, completed: !t.completed };
      }
      return t;
    });
    saveTasks(updated);
    loadData();
  };

  const handleToggleReminder = (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Stop navigation click
    const allTasks = getTasks();
    const updated = allTasks.map(t => {
      if (t.id === taskId) {
        return { ...t, setReminder: !t.setReminder };
      }
      return t;
    });
    saveTasks(updated);
    loadData();
  };

  const handleNavigateToEnquiry = (enquiryId: number, tab?: string) => {
    localStorage.setItem('crm_goto_enquiry', enquiryId.toString());
    if (tab) {
      localStorage.setItem('crm_goto_enquiry_tab', tab);
    }
    
    // Dispatch navigation event
    window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
      detail: { workspace: 'Home', page: 'Enquiry' }
    }));

    // Dispatch update event to force re-evaluation of redirect
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('crm-store-update'));
    }, 50);
  };

  // Filter lists
  const myTasks = tasks.filter(t => 
    !t.completed && 
    (t.assignee === 'Roop Raman' || t.assignee === 'Current User')
  );

  const reminders = tasks.filter(t => 
    !t.completed && 
    t.setReminder &&
    (t.assignee === 'Roop Raman' || t.assignee === 'Current User')
  );

  const displayTasks = expanded ? myTasks : myTasks.slice(0, 3);
  const displayReminders = expanded ? reminders : reminders.slice(0, 3);
  const displayMentions = expanded ? MOCK_MENTIONS : MOCK_MENTIONS.slice(0, 3);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'text-red-600 bg-red-50 border-red-100';
      case 'High': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'Medium': return 'text-blue-600 bg-blue-50 border-blue-100';
      default: return 'text-green-600 bg-green-50 border-green-100';
    }
  };

  // Quick Directory contacts - active partners
  const activePartners = MOCK_PARTNERS.filter(p => p.status === 'Active').slice(0, 3);

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in duration-300">
      {/* Dynamic Action Center Card */}
      <GlassCard intensity="light" className="p-6 flex flex-col h-[460px] border border-neutral-200/40 shadow-md">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-50 via-pink-50 to-orange-100/80 text-rose-800 border border-rose-200/80 flex items-center justify-center shrink-0 shadow-2xs">
              <Bell size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-[#1a1a1a] truncate">Inbox & Updates</h2>
              <p className="text-xs text-neutral-500 font-medium truncate">Tasks, reminders & mentions</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              onClick={() => setExpanded(!expanded)}
              className="px-2.5 py-1 text-xs font-semibold rounded-full bg-white border border-neutral-200/80 text-neutral-700 hover:bg-neutral-100 transition-all shadow-2xs"
            >
              {expanded ? 'Collapse' : 'View All'}
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-neutral-100 p-1 rounded-xl mb-4 border border-neutral-200/20">
          <button
            onClick={() => { setActiveTab('tasks'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'tasks' 
                ? 'bg-white text-neutral-900 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <CheckSquare size={14} />
            Tasks
            {myTasks.length > 0 && (
              <span className="bg-neutral-900 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {myTasks.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => { setActiveTab('reminders'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'reminders' 
                ? 'bg-white text-neutral-900 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Clock size={14} />
            Reminders
            {reminders.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {reminders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('mentions'); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'mentions' 
                ? 'bg-white text-neutral-900 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <AtSign size={14} />
            Mentions
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              2
            </span>
          </button>
        </div>

        {/* Tab contents list */}
        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1.5 scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-neutral-200/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-track]:bg-transparent">
          
          {/* TASKS TAB */}
          {activeTab === 'tasks' && (
            displayTasks.length === 0 ? (
              <EmptyState icon={<CheckSquare size={24} />} message="All caught up! No pending tasks assigned to you." />
            ) : (
              displayTasks.map(task => {
                const linkedEnq = enquiries.find(e => e.id === task.enquiryId);
                return (
                  <div 
                    key={task.id}
                    onClick={() => task.enquiryId && handleNavigateToEnquiry(task.enquiryId, 'tasks')}
                    className="p-3 bg-white/70 hover:bg-white border border-neutral-100 hover:border-neutral-200 rounded-xl transition-all cursor-pointer flex items-start gap-3 group shadow-sm"
                  >
                    <button 
                      onClick={(e) => handleToggleTask(task.id, e)}
                      className="w-5 h-5 rounded-md border border-neutral-300 hover:border-blue-500 flex items-center justify-center mt-0.5 shrink-0 transition-colors bg-white hover:bg-blue-50"
                    >
                      <span className="text-transparent hover:text-blue-500 text-[10px]">✔</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-neutral-800 leading-normal line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {task.title}
                        </h4>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${getPriorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                      
                      {linkedEnq && (
                        <div className="text-[10px] text-neutral-500 mt-1 font-medium flex items-center gap-1">
                          <Building2 size={10} />
                          {linkedEnq.enquiryNumber} • {linkedEnq.title}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-100/50">
                        <span className="text-[10px] text-neutral-400 font-medium">Due: {task.dueDate}</span>
                        <span className="text-[10px] text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
                          View details <ChevronRight size={10} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}

          {/* REMINDERS TAB */}
          {activeTab === 'reminders' && (
            displayReminders.length === 0 ? (
              <EmptyState icon={<Clock size={24} />} message="No upcoming reminders set." />
            ) : (
              displayReminders.map(task => {
                const linkedEnq = enquiries.find(e => e.id === task.enquiryId);
                return (
                  <div 
                    key={task.id}
                    onClick={() => task.enquiryId && handleNavigateToEnquiry(task.enquiryId, 'tasks')}
                    className="p-3 bg-white/70 hover:bg-white border border-neutral-100 hover:border-neutral-200 rounded-xl transition-all cursor-pointer flex items-start gap-3 group shadow-sm"
                  >
                    <button 
                      onClick={(e) => handleToggleReminder(task.id, e)}
                      className="w-5 h-5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center justify-center mt-0.5 shrink-0 transition-colors"
                      title="Mute reminder"
                    >
                      <Clock size={11} className="text-amber-600" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-neutral-800 leading-normal line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {task.title}
                        </h4>
                      </div>
                      
                      {linkedEnq && (
                        <div className="text-[10px] text-neutral-500 mt-1 font-medium flex items-center gap-1">
                          <Building2 size={10} />
                          {linkedEnq.enquiryNumber}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-100/50">
                        <span className="text-[10px] text-red-500 font-semibold flex items-center gap-1">
                          <AlertCircle size={10} /> Alert set for {task.dueDate}
                        </span>
                        <span className="text-[10px] text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
                          Open <ChevronRight size={10} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}

          {/* MENTIONS TAB */}
          {activeTab === 'mentions' && (
            displayMentions.map(mention => (
              <div 
                key={mention.id}
                onClick={() => handleNavigateToEnquiry(mention.enquiryId)}
                className={`p-3 border rounded-xl transition-all cursor-pointer flex items-start gap-3 group shadow-sm ${
                  mention.unread 
                    ? 'bg-blue-50/40 border-blue-100 hover:bg-blue-50/70' 
                    : 'bg-white/70 border-neutral-100 hover:bg-white'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-neutral-200">
                  {mention.author.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-neutral-900">{mention.author}</span>
                    <span className="text-[9px] text-neutral-400 font-medium">{mention.time}</span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed group-hover:text-neutral-800 transition-colors">
                    {mention.content}
                  </p>
                  <div className="mt-2 flex items-center justify-between pt-1 border-t border-neutral-100/30">
                    <span className="text-[9px] font-semibold text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded flex items-center gap-1">
                      <MessageSquare size={8} /> Enquiry #{mention.enquiryId}
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
                      Respond <ChevronRight size={10} />
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}

        </div>
      </GlassCard>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode, message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-neutral-200/60 rounded-xl bg-white/20">
      <div className="text-neutral-300 mb-2">
        {icon}
      </div>
      <p className="text-neutral-500 font-medium text-xs leading-relaxed max-w-[180px]">
        {message}
      </p>
    </div>
  );
}
