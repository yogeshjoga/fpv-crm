import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Calendar, User, Building2, AlertCircle, FileText, CheckCircle2, Circle, Clock, Check, Users, MessageSquare, Phone, Mail, Paperclip, CheckSquare, Hash, Link as LinkIcon, Briefcase, List, Download, X, Save, RefreshCw, Search, ChevronLeft, ChevronRight, Bell, Trash2 } from 'lucide-react';
import { GlassCard } from '../../components/ui/shared';
import { MOCK_PARTNERS, MOCK_PRODUCTS, MOCK_USERS } from '../../data/mockData';
import { useNotifications } from '../../context/NotificationContext';
import { getEnquiries, saveEnquiries, getTasks, saveTasks, getActivities, saveActivities, Task } from '../../utils/crmStore';

const mapActivityIconAndColor = (type: string) => {
  let icon, iconColor;
  switch (type) {
    case 'Log Call':
      icon = <Phone size={18} />;
      iconColor = 'bg-blue-100 text-blue-600';
      break;
    case 'Log Email':
      icon = <Mail size={18} />;
      iconColor = 'bg-green-100 text-green-600';
      break;
    case 'Log Meeting':
      icon = <Users size={18} />;
      iconColor = 'bg-purple-100 text-purple-600';
      break;
    case 'Log Visit':
      icon = <Building2 size={18} />;
      iconColor = 'bg-orange-100 text-orange-600';
      break;
    default:
      icon = <FileText size={18} />;
      iconColor = 'bg-neutral-100 text-neutral-600';
      break;
  }
  return { icon, iconColor };
};

const STAGES = [
  'New',
  'In Progress',
  'Quotation',
  'Followup',
  'Negotiation',
  'Won',
  'Lost',
  'Sales Order'
];

export function EnquiryDetail({ enquiryId, onBack }: { enquiryId: number, onBack: () => void }) {
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<'details' | 'activities' | 'tasks' | 'comparison' | 'timeline' | 'procurement'>('details');

  // Check for tab redirect
  useEffect(() => {
    const tab = localStorage.getItem('crm_goto_enquiry_tab');
    if (tab) {
      setActiveTab(tab as any);
      localStorage.removeItem('crm_goto_enquiry_tab');
    }
  }, [enquiryId]);

  const enquiriesList = getEnquiries();
  const enquiry = enquiriesList.find(e => e.id === enquiryId);
  const company = MOCK_PARTNERS.find(p => p.id === enquiry?.companyId);
  const contact = company?.contacts?.find(c => c.id === enquiry?.contactId);

  // Add state for editing stage
  const [currentStage, setCurrentStage] = useState(enquiry?.stage || STAGES[0]);
  const [assignedTo, setAssignedTo] = useState(enquiry?.assignedTo || '');

  // Synchronize stage and assignedTo updates with localStorage crmStore
  useEffect(() => {
    if (enquiry) {
      const list = getEnquiries();
      const updated = list.map(e => {
        if (e.id === enquiryId) {
          return { ...e, stage: currentStage, assignedTo };
        }
        return e;
      });
      saveEnquiries(updated);
    }
  }, [currentStage, assignedTo, enquiryId]);
  
  // Activities state
  const [activities, setActivities] = useState<any[]>(() => {
    const all = getActivities().filter(a => a.enquiryId === enquiryId);
    if (all.length > 0) {
      return all.map(a => {
        const { icon, iconColor } = mapActivityIconAndColor(a.type);
        return { ...a, icon, iconColor };
      });
    }
    
    // Default initial activity for this enquiry if none in global store
    const defaultAct = {
      id: 200000 + (enquiryId || 0),
      enquiryId,
      type: 'Log Call',
      title: 'Outbound Call',
      timestamp: 'Today, 10:30 AM',
      description: 'Spoke with customer regarding the required quantity and timeline. They need it expedited.',
      attachment: null,
      followUpDate: new Date(Date.now() + 86400000 * 2).toISOString().substring(0, 16)
    };
    const { icon, iconColor } = mapActivityIconAndColor(defaultAct.type);
    return [{ ...defaultAct, icon, iconColor }];
  });

  // Synchronize activities with global crmStore
  useEffect(() => {
    if (enquiryId) {
      const allActivities = getActivities();
      const otherActivities = allActivities.filter(a => a.enquiryId !== enquiryId);
      const strippedActivities = activities.map(({ icon, iconColor, ...rest }) => ({
        ...rest,
        enquiryId
      }));
      saveActivities([...otherActivities, ...strippedActivities]);
    }
  }, [activities, enquiryId]);

  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [activityType, setActivityType] = useState('Add Note');
  const [activityContent, setActivityContent] = useState('');
  const [activityAttachment, setActivityAttachment] = useState('');
  const [activityFollowUpDate, setActivityFollowUpDate] = useState('');
  const [activitySetReminder, setActivitySetReminder] = useState(false);
  
  // Activity list states
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('All');
  const [activityPage, setActivityPage] = useState(1);
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const activitiesPerPage = 5;

  // Task list states loaded dynamically from getTasks()
  const [tasks, setTasks] = useState<Task[]>(() => {
    const existing = getTasks().filter(t => t.enquiryId === enquiryId);
    if (existing.length > 0) return existing;
    return [
      {
        id: 100000 + (enquiryId || 0),
        enquiryId,
        title: 'Prepare initial quotation',
        assignee: 'Sales Team A',
        priority: 'High' as any,
        dueDate: '2026-07-21T14:30',
        completed: false,
        setReminder: true
      }
    ];
  });

  // Synchronize task states with central crmStore
  useEffect(() => {
    if (enquiryId) {
      const allTasks = getTasks();
      const otherTasks = allTasks.filter(t => t.enquiryId !== enquiryId);
      const mappedTasks = tasks.map(t => ({
        ...t,
        enquiryId
      }));
      saveTasks([...otherTasks, ...mappedTasks]);
    }
  }, [tasks, enquiryId]);

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskSetReminder, setTaskSetReminder] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  const handleEditTaskClick = (task: any) => {
    setTaskTitle(task.title);
    setTaskAssignee(task.assignee);
    setTaskPriority(task.priority);
    setTaskDueDate(task.dueDate || '');
    setTaskSetReminder(task.setReminder);
    setEditingTaskId(task.id);
    setTaskFormOpen(true);
  };

  const handleCancelTask = () => {
    setTaskTitle('');
    setTaskAssignee('');
    setTaskPriority('Medium');
    setTaskDueDate('');
    setTaskSetReminder(false);
    setTaskFormOpen(false);
    setEditingTaskId(null);
  };

  const handleSaveTask = () => {
    if (!taskTitle.trim() || !taskAssignee.trim()) return;

    if (editingTaskId) {
      setTasks(tasks.map(task => {
        if (task.id === editingTaskId) {
          return {
            ...task,
            title: taskTitle,
            assignee: taskAssignee,
            priority: taskPriority,
            dueDate: taskDueDate || '',
            setReminder: taskSetReminder
          };
        }
        return task;
      }));
    } else {
      setTasks([{
        id: Date.now(),
        enquiryId,
        title: taskTitle,
        assignee: taskAssignee,
        priority: taskPriority,
        dueDate: taskDueDate || '',
        completed: false,
        setReminder: taskSetReminder
      }, ...tasks]);
    }

    if (taskSetReminder && taskDueDate) {
      addNotification({
        title: `Task Reminder: ${taskTitle}`,
        message: `Task assigned to ${taskAssignee} is due.`,
        date: new Date(taskDueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      });
    }

    handleCancelTask();
  };

  const handleToggleTaskComplete = (taskId: number) => {
    setTasks(tasks.map(task => task.id === taskId ? { ...task, completed: !task.completed } : task));
  };

  const handleDeleteTask = (taskId: number) => {
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const handleEditActivityClick = (activity: any) => {
    setActivityType(activity.type);
    setActivityContent(activity.description);
    setActivityAttachment(activity.attachment || '');
    setActivityFollowUpDate(activity.followUpDate || '');
    setActivitySetReminder(!!activity.followUpDate);
    setEditingActivityId(activity.id);
    setActivityFormOpen(true);
    // Scroll to the form area
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelActivity = () => {
    setActivityContent('');
    setActivityAttachment('');
    setActivityFollowUpDate('');
    setActivitySetReminder(false);
    setActivityFormOpen(false);
    setEditingActivityId(null);
  };

  const handleAddActivity = () => {
    if (!activityContent.trim()) return;
    
    let icon, iconColor, title;
    switch(activityType) {
      case 'Log Call': icon = <Phone size={18} />; iconColor = 'bg-blue-100 text-blue-600'; title = 'Outbound Call'; break;
      case 'Log Email': icon = <Mail size={18} />; iconColor = 'bg-green-100 text-green-600'; title = 'Email Sent'; break;
      case 'Log Meeting': icon = <Users size={18} />; iconColor = 'bg-purple-100 text-purple-600'; title = 'Meeting Logged'; break;
      case 'Log Visit': icon = <Building2 size={18} />; iconColor = 'bg-orange-100 text-orange-600'; title = 'Site Visit'; break;
      default: icon = <FileText size={18} />; iconColor = 'bg-neutral-100 text-neutral-600'; title = 'Note Added'; break;
    }

    if (editingActivityId) {
      setActivities(activities.map(activity => {
        if (activity.id === editingActivityId) {
          return {
            ...activity,
            type: activityType,
            icon,
            iconColor,
            title,
            description: activityContent,
            attachment: activityAttachment || null,
            followUpDate: activityFollowUpDate || null
          };
        }
        return activity;
      }));
    } else {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setActivities([{
        id: Date.now(),
        type: activityType,
        icon,
        iconColor,
        title,
        timestamp: `Today, ${timeString}`,
        description: activityContent,
        attachment: activityAttachment || null,
        followUpDate: activityFollowUpDate || null
      }, ...activities]);
    }

    if (activitySetReminder && activityFollowUpDate) {
      addNotification({
        type: 'REMINDER',
        title: `Reminder: ${title}`,
        message: activityContent,
        date: new Date(activityFollowUpDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      });
    }

    // Check for mentions
    MOCK_USERS.forEach(user => {
      if (activityContent.includes(`@${user.name}`)) {
        addNotification({
          type: 'MENTION',
          title: `Mentioned in ${enquiry?.enquiryNumber}`,
          message: `${activityContent}`,
          date: 'Just now'
        });
      }
    });

    setActivityContent('');
    setActivityAttachment('');
    setActivityFollowUpDate('');
    setActivitySetReminder(false);
    setActivityFormOpen(false);
    setEditingActivityId(null);
    if (!editingActivityId) {
      setActivityPage(1); // Reset to first page when new activity is added
    }
  };

  const [vendors, setVendors] = useState(() => {
    if (enquiry) {
      const vendorMap = new Map();
      enquiry.items.forEach((item, itemIdx) => {
        if (item.productId) {
          const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
          if (product && product.vendors) {
            product.vendors.forEach(pv => {
              if (!vendorMap.has(pv.vendorId)) {
                vendorMap.set(pv.vendorId, {
                  id: pv.vendorId,
                  name: MOCK_PARTNERS.find(bp => bp.id === pv.vendorId)?.name || 'Unknown Vendor',
                  attachment: 'system_quote.pdf',
                  prices: Array(enquiry.items.length).fill(0),
                  isSelected: false
                });
              }
              const v = vendorMap.get(pv.vendorId);
              v.prices[itemIdx] = pv.purchasePrice;
            });
          }
        }
      });
      
      const initialVendors = Array.from(vendorMap.values());
      if (initialVendors.length > 0) {
        initialVendors.forEach(v => {
          v.totalValue = v.prices.reduce((sum: number, price: number, idx: number) => sum + (price * enquiry.items[idx].quantity), 0);
        });
        initialVendors[0].isSelected = true;
        return initialVendors;
      }
    }
    return [
      { id: 1, name: 'Vendor A (ABC Corp)', attachment: 'quotation_abc.pdf', totalValue: 45000, isSelected: true, prices: (enquiry?.items || []).map(i => Number(i.targetPrice || 100) * 0.95) },
      { id: 2, name: 'Vendor B (XYZ Ltd)', attachment: 'quote_xyz_v2.pdf', totalValue: 49500, isSelected: false, prices: (enquiry?.items || []).map(i => Number(i.targetPrice || 100) * 1.05) }
    ];
  });

  const [selectedVendorsPerItem, setSelectedVendorsPerItem] = useState<{ [itemIdx: number]: number }>(() => {
    const initial: { [itemIdx: number]: number } = {};
    if (enquiry) {
      enquiry.items.forEach((item, idx) => {
        const product = item.productId ? MOCK_PRODUCTS.find(p => p.id === item.productId) : null;
        if (product && product.vendors && product.vendors.length > 0) {
           initial[idx] = product.vendors[0].vendorId;
        } else {
           initial[idx] = 1; // Default fallback
        }
      });
    }
    return initial;
  });

  const syncVendorPrices = () => {
    if (enquiry) {
      const vendorMap = new Map();
      enquiry.items.forEach((item, itemIdx) => {
        if (item.productId) {
          const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
          if (product && product.vendors) {
            product.vendors.forEach(pv => {
              if (!vendorMap.has(pv.vendorId)) {
                vendorMap.set(pv.vendorId, {
                  id: pv.vendorId,
                  name: MOCK_PARTNERS.find(bp => bp.id === pv.vendorId)?.name || 'Unknown Vendor',
                  attachment: 'system_quote.pdf',
                  prices: Array(enquiry.items.length).fill(0),
                  isSelected: false
                });
              }
              const v = vendorMap.get(pv.vendorId);
              v.prices[itemIdx] = pv.purchasePrice;
            });
          }
        }
      });
      
      const newVendors = Array.from(vendorMap.values());
      if (newVendors.length > 0) {
        newVendors.forEach(v => {
          v.totalValue = v.prices.reduce((sum: number, price: number, idx: number) => sum + (price * enquiry.items[idx].quantity), 0);
        });
        const currentlySelected = vendors.find(v => v.isSelected);
        if (currentlySelected && newVendors.find(v => v.id === currentlySelected.id)) {
          newVendors.find(v => v.id === currentlySelected.id)!.isSelected = true;
        } else {
          newVendors[0].isSelected = true;
        }
        setVendors(newVendors);
      }
    }
  };

  if (!enquiry) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-bold text-neutral-800">Enquiry not found</h2>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  const currentStageIndex = STAGES.indexOf(currentStage as any) !== -1 ? STAGES.indexOf(currentStage as any) : 0;

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-[#1a1a1a]">{enquiry.enquiryNumber}</h2>
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                enquiry.status === 'Open' ? 'bg-blue-50 text-blue-700' :
                enquiry.status === 'Closed' ? 'bg-neutral-100 text-neutral-600' :
                'bg-orange-50 text-orange-700'
              }`}>
                {enquiry.status}
              </span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                enquiry.priority === 'Critical' || enquiry.priority === 'High' ? 'bg-red-50 text-red-700' :
                'bg-neutral-100 text-neutral-700'
              }`}>
                {enquiry.priority} Priority
              </span>
            </div>
            <p className="text-sm font-medium text-neutral-600">{enquiry.title}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select 
            value={currentStage}
            onChange={(e) => setCurrentStage(e.target.value as any)}
            className="px-3 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {STAGES.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors">
            <Edit2 size={16} /> Edit
          </button>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <GlassCard intensity="light" className="p-6">
        <div className="flex justify-between items-center relative z-0">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-neutral-200 -z-10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-500 ease-in-out" 
              style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
            ></div>
          </div>
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            return (
              <div key={stage} className="flex flex-col items-center gap-2" title={stage}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 shadow-sm
                  ${isCompleted ? 'bg-blue-600 text-white border-none' : 
                    isCurrent ? 'bg-white border-2 border-blue-600 text-blue-600' : 
                    'bg-white border-2 border-neutral-200 text-neutral-400'}`}>
                  {isCompleted ? <Check size={16} strokeWidth={3} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                </div>
                <span className={`text-[10px] font-semibold text-center max-w-[70px] leading-tight ${
                  isCompleted || isCurrent ? 'text-neutral-800' : 'text-neutral-400'
                }`}>
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column (Key Info) */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <GlassCard intensity="light" className="p-6">
            <h3 className="font-semibold text-base mb-5 flex items-center gap-2">
              <FileText size={18} className="text-neutral-500" /> Key Information
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Customer</span>
                <div className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a]">
                  <Building2 size={14} className="text-neutral-400" />
                  {company?.name || 'Unknown'}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Contact</span>
                <div className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a]">
                  <User size={14} className="text-neutral-400" />
                  {contact?.name || 'Unknown'}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Sales Owner</span>
                <div className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a]">
                  <Briefcase size={14} className="text-neutral-400" />
                  {assignedTo || 'Unassigned'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Enquiry Date</span>
                  <span className="text-sm font-medium text-[#1a1a1a]">{enquiry.date}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Required By</span>
                  <span className="text-sm font-medium text-orange-600">{enquiry.requiredByDate || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard intensity="light" className="p-6">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <Users size={18} className="text-neutral-500" /> Team Assignment
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 bg-neutral-50/50">
                <div className="flex flex-col w-full">
                  <span className="text-xs font-bold text-neutral-500 mb-1.5">Sales Owner</span>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg text-sm px-2 py-1.5 focus:outline-none focus:border-blue-500 font-medium text-[#1a1a1a]"
                  >
                    <option value="">Select User</option>
                    {MOCK_USERS.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 bg-white">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-neutral-500 mb-0.5">Technical</span>
                  <span className="text-sm font-medium text-neutral-400">Not assigned</span>
                </div>
                <button className="text-xs font-medium text-blue-600 hover:underline">Assign</button>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column (Tabs) */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          <GlassCard intensity="light" className="p-1">
            <div className="flex overflow-x-auto hide-scrollbar">
              {['details', 'activities', 'tasks', 'comparison', 'timeline', 'procurement'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 px-4 py-3 text-sm font-semibold rounded-xl capitalize transition-colors whitespace-nowrap ${
                    activeTab === tab ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Details Tab Content */}
          {activeTab === 'details' && (
            <div className="flex flex-col gap-6">
              <GlassCard intensity="light" className="p-6">
                <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                  <Hash size={18} className="text-neutral-500" /> Description
                </h3>
                <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">
                  {enquiry.description || 'No description provided.'}
                </p>
              </GlassCard>

              <GlassCard intensity="light" className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <List size={18} className="text-neutral-500" /> Products / Items
                  </h3>
                  <span className="px-2.5 py-1 bg-neutral-100 rounded-md text-xs font-semibold text-neutral-600">
                    {enquiry.items.length} Items
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="pb-3 font-semibold text-neutral-500">Product</th>
                        <th className="pb-3 font-semibold text-neutral-500">Quantity</th>
                        <th className="pb-3 font-semibold text-neutral-500">Target Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {enquiry.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-3 font-medium text-neutral-800">{item.product}</td>
                          <td className="py-3 text-neutral-600">{item.quantity} {item.unit || 'Nos'}</td>
                          <td className="py-3 text-neutral-600">{item.targetPrice ? `₹${item.targetPrice}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>

              {/* Attachments Section moved to Details */}
              <GlassCard intensity="light" className="p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Paperclip size={18} className="text-neutral-500" /> Attachments
                  </h3>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] text-white rounded-lg text-sm font-medium hover:bg-black transition-colors shadow-sm">
                    <Paperclip size={14} /> Upload
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg bg-white hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 bg-red-50 text-red-500 rounded flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-medium text-sm text-[#1a1a1a] truncate">requirements_spec.pdf</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">2.4 MB</p>
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* Activities Tab */}
          {activeTab === 'activities' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                <button 
                  onClick={() => { setActivityType('Add Note'); setActivityFormOpen(true); }}
                  className={`flex items-center gap-2 px-4 py-2 bg-white border ${activityFormOpen && activityType === 'Add Note' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-200'} rounded-lg text-sm font-medium hover:bg-neutral-50 shadow-sm whitespace-nowrap transition-colors`}
                >
                  <FileText size={16} className={activityFormOpen && activityType === 'Add Note' ? 'text-blue-600' : 'text-neutral-500'} /> Add Note
                </button>
                <button 
                  onClick={() => { setActivityType('Log Call'); setActivityFormOpen(true); }}
                  className={`flex items-center gap-2 px-4 py-2 bg-white border ${activityFormOpen && activityType === 'Log Call' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-200'} rounded-lg text-sm font-medium hover:bg-neutral-50 shadow-sm whitespace-nowrap transition-colors`}
                >
                  <Phone size={16} className={activityFormOpen && activityType === 'Log Call' ? 'text-blue-600' : 'text-neutral-500'} /> Log Call
                </button>
                <button 
                  onClick={() => { setActivityType('Log Email'); setActivityFormOpen(true); }}
                  className={`flex items-center gap-2 px-4 py-2 bg-white border ${activityFormOpen && activityType === 'Log Email' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-200'} rounded-lg text-sm font-medium hover:bg-neutral-50 shadow-sm whitespace-nowrap transition-colors`}
                >
                  <Mail size={16} className={activityFormOpen && activityType === 'Log Email' ? 'text-blue-600' : 'text-neutral-500'} /> Log Email
                </button>
                <button 
                  onClick={() => { setActivityType('Log Meeting'); setActivityFormOpen(true); }}
                  className={`flex items-center gap-2 px-4 py-2 bg-white border ${activityFormOpen && activityType === 'Log Meeting' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-200'} rounded-lg text-sm font-medium hover:bg-neutral-50 shadow-sm whitespace-nowrap transition-colors`}
                >
                  <Users size={16} className={activityFormOpen && activityType === 'Log Meeting' ? 'text-blue-600' : 'text-neutral-500'} /> Log Meeting
                </button>
                <button 
                  onClick={() => { setActivityType('Log Visit'); setActivityFormOpen(true); }}
                  className={`flex items-center gap-2 px-4 py-2 bg-white border ${activityFormOpen && activityType === 'Log Visit' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-neutral-200'} rounded-lg text-sm font-medium hover:bg-neutral-50 shadow-sm whitespace-nowrap transition-colors`}
                >
                  <Building2 size={16} className={activityFormOpen && activityType === 'Log Visit' ? 'text-blue-600' : 'text-neutral-500'} /> Log Visit
                </button>
              </div>

              {activityFormOpen && (
                <GlassCard intensity="light" className="p-5 border-blue-200 shadow-md animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-[#1a1a1a]">{editingActivityId ? `Edit ${activityType}` : activityType}</h3>
                    <button onClick={handleCancelActivity} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                  
                  <textarea 
                    value={activityContent}
                    onChange={(e) => setActivityContent(e.target.value)}
                    placeholder={`Enter details for ${activityType.toLowerCase()}... (Type @ to mention users)`}
                    className="w-full h-24 p-3 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none text-sm mb-4"
                    autoFocus
                  />
                  
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-neutral-500">Follow-up Date & Time</label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <span className={`text-[11px] font-medium transition-colors ${activitySetReminder ? 'text-blue-600' : 'text-neutral-400'}`}>
                            <Bell size={12} className="inline-block mr-1 mb-0.5" />
                            Remind Me
                          </span>
                          <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${activitySetReminder ? 'bg-blue-500' : 'bg-neutral-200'}`}>
                            <input
                              type="checkbox"
                              checked={activitySetReminder}
                              onChange={(e) => setActivitySetReminder(e.target.checked)}
                              className="sr-only"
                            />
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${activitySetReminder ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                          </div>
                        </label>
                      </div>
                      <input 
                        type="datetime-local" 
                        value={activityFollowUpDate}
                        onChange={(e) => setActivityFollowUpDate(e.target.value)}
                        className="w-full p-2 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Attachment</label>
                      <div className="flex items-center gap-2 w-full p-2 rounded-lg border border-neutral-200 bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all text-sm">
                        <Paperclip size={16} className="text-neutral-400 shrink-0" />
                        <input 
                          type="file"
                          onChange={(e) => setActivityAttachment(e.target.files?.[0]?.name || '')}
                          className="w-full text-xs text-neutral-600 file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={handleCancelActivity}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAddActivity}
                      disabled={!activityContent.trim()}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1a1a1a] text-white hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save size={16} /> {editingActivityId ? 'Update Activity' : 'Save Activity'}
                    </button>
                  </div>
                </GlassCard>
              )}

              <GlassCard intensity="light" className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="font-semibold text-base">Activity Logs</h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Search logs..."
                        value={activitySearch}
                        onChange={(e) => setActivitySearch(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full sm:w-[200px]"
                      />
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    </div>
                    <select 
                      value={activityFilter}
                      onChange={(e) => { setActivityFilter(e.target.value); setActivityPage(1); }}
                      className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="All">All Types</option>
                      <option value="Add Note">Notes</option>
                      <option value="Log Call">Calls</option>
                      <option value="Log Email">Emails</option>
                      <option value="Log Meeting">Meetings</option>
                      <option value="Log Visit">Visits</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {(() => {
                    const filteredActivities = activities.filter(a => {
                      const matchesSearch = a.title.toLowerCase().includes(activitySearch.toLowerCase()) || a.description.toLowerCase().includes(activitySearch.toLowerCase());
                      const matchesFilter = activityFilter === 'All' || a.type === activityFilter;
                      return matchesSearch && matchesFilter;
                    });
                    
                    const totalPages = Math.ceil(filteredActivities.length / activitiesPerPage);
                    const currentActivities = filteredActivities.slice((activityPage - 1) * activitiesPerPage, activityPage * activitiesPerPage);

                    if (filteredActivities.length === 0) {
                      return <div className="text-center py-12 text-neutral-500 text-sm bg-neutral-50/50 rounded-xl border border-neutral-100">No activities found matching your criteria.</div>;
                    }

                    return (
                      <>
                        {currentActivities.map(activity => (
                          <div key={activity.id} className="flex gap-4 p-5 border border-neutral-100 rounded-xl bg-neutral-50/50 hover:bg-white hover:shadow-sm transition-all group relative">
                            <div className={`w-10 h-10 ${activity.iconColor} rounded-full flex items-center justify-center shrink-0 shadow-sm`}>
                              {activity.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1 sm:gap-4">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-semibold text-sm text-[#1a1a1a] truncate">{activity.title}</span>
                                  <span className="text-xs text-neutral-400 shrink-0">• {activity.timestamp}</span>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleEditActivityClick(activity)} className="w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors" title="Edit">
                                    <Edit2 size={13} />
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed mb-3">{activity.description}</p>
                              
                              {(activity.attachment || activity.followUpDate) && (
                                <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-neutral-100">
                                  {activity.attachment && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors">
                                      <Paperclip size={12} />
                                      <span className="truncate max-w-[150px]">{activity.attachment}</span>
                                    </div>
                                  )}
                                  {activity.followUpDate && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 text-orange-700 rounded-md text-xs font-medium border border-orange-100">
                                      <Calendar size={12} />
                                      <span>Follow-up: {new Date(activity.followUpDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                            <span className="text-xs text-neutral-500 font-medium">
                              Showing {((activityPage - 1) * activitiesPerPage) + 1} to {Math.min(activityPage * activitiesPerPage, filteredActivities.length)} of {filteredActivities.length}
                            </span>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                                disabled={activityPage === 1}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 hover:text-neutral-700 transition-colors"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                  key={page}
                                  onClick={() => setActivityPage(page)}
                                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${activityPage === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                                >
                                  {page}
                                </button>
                              ))}
                              <button 
                                onClick={() => setActivityPage(p => Math.min(totalPages, p + 1))}
                                disabled={activityPage === totalPages}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 hover:text-neutral-700 transition-colors"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </GlassCard>
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="flex flex-col gap-6">
              <GlassCard intensity="light" className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-base text-[#1a1a1a]">Internal Tasks</h3>
                    <p className="text-sm text-neutral-500 mt-1">Manage and assign tasks for this enquiry.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setTaskFormOpen(true);
                      setEditingTaskId(null);
                    }}
                    className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg text-sm font-medium hover:bg-black transition-colors"
                  >
                    Add Task
                  </button>
                </div>
                
                {taskFormOpen && (
                  <div className="bg-neutral-50 rounded-xl p-5 mb-6 border border-neutral-200 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-[#1a1a1a]">{editingTaskId ? 'Edit Task' : 'New Task'}</h4>
                      <button onClick={handleCancelTask} className="text-neutral-400 hover:text-neutral-700">
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Task Title</label>
                        <input 
                          type="text" 
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          placeholder="e.g. Prepare initial quotation"
                          className="w-full p-2.5 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                          autoFocus
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Assignee</label>
                        <select
                          value={taskAssignee}
                          onChange={(e) => setTaskAssignee(e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        >
                          <option value="">Select Assignee</option>
                          {MOCK_USERS.map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Priority</label>
                        <select
                          value={taskPriority}
                          onChange={(e) => setTaskPriority(e.target.value as 'Low' | 'Medium' | 'High')}
                          className="w-full p-2.5 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        >
                          <option value="Low">Low Priority</option>
                          <option value="Medium">Medium Priority</option>
                          <option value="High">High Priority</option>
                        </select>
                      </div>
                      
                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-neutral-500">Due Date & Time</label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <span className={`text-[11px] font-medium transition-colors ${taskSetReminder ? 'text-blue-600' : 'text-neutral-400'}`}>
                              <Bell size={12} className="inline-block mr-1 mb-0.5" />
                              Remind Assignee
                            </span>
                            <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${taskSetReminder ? 'bg-blue-500' : 'bg-neutral-200'}`}>
                              <input
                                type="checkbox"
                                checked={taskSetReminder}
                                onChange={(e) => setTaskSetReminder(e.target.checked)}
                                className="sr-only"
                              />
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${taskSetReminder ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                            </div>
                          </label>
                        </div>
                        <input 
                          type="datetime-local" 
                          value={taskDueDate}
                          onChange={(e) => setTaskDueDate(e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={handleCancelTask}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveTask}
                        disabled={!taskTitle.trim() || !taskAssignee.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1a1a1a] text-white hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <Save size={16} /> {editingTaskId ? 'Update Task' : 'Save Task'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {tasks.length === 0 ? (
                    <div className="py-8 text-center text-neutral-500 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50 text-sm">
                      No tasks assigned yet.
                    </div>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className={`flex items-center justify-between p-4 border border-neutral-200 rounded-xl bg-white shadow-sm transition-all group ${task.completed ? 'opacity-60 bg-neutral-50' : ''}`}>
                        <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
                          <input 
                            type="checkbox" 
                            checked={task.completed}
                            onChange={() => handleToggleTaskComplete(task.id)}
                            className="mt-1 w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`font-medium text-sm truncate ${task.completed ? 'text-neutral-500 line-through' : 'text-[#1a1a1a]'}`}>{task.title}</p>
                            <p className="text-xs text-neutral-500 mt-1 truncate flex flex-wrap items-center gap-1">
                              Assigned to: <span className="font-medium text-neutral-700">{task.assignee}</span>
                              {task.setReminder && (
                                <span className="inline-flex items-center text-blue-600 ml-2" title="Reminder Set">
                                  <Bell size={10} className="mr-0.5" /> Reminder On
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right hidden sm:block">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide mb-1 ${
                              task.priority === 'High' ? 'bg-red-50 text-red-700' : 
                              task.priority === 'Medium' ? 'bg-orange-50 text-orange-700' : 
                              'bg-green-50 text-green-700'
                            }`}>
                              {task.priority} Priority
                            </span>
                            {task.dueDate && (
                              <p className={`text-[11px] ${new Date(task.dueDate) < new Date() && !task.completed ? 'text-red-500 font-medium' : 'text-neutral-500'}`}>
                                Due: {new Date(task.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEditTaskClick(task)}
                              className="w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors" 
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className="w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors" 
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            </div>
          )}

          {/* Comparison Tab */}
          {activeTab === 'comparison' && (
            <GlassCard intensity="light" className="p-6 flex flex-col gap-6 bg-neutral-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base text-[#1a1a1a]">Vendor Price Comparison</h3>
                  <p className="text-sm text-neutral-500 mt-1">Add and compare prices from different vendors before quotation.</p>
                </div>
                <button 
                  onClick={syncVendorPrices}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white rounded-lg text-sm font-medium hover:bg-black transition-colors shadow-sm"
                >
                  <RefreshCw size={14} /> Sync Latest Prices
                </button>
              </div>

              <div className="flex flex-col gap-8 mt-2">
                {enquiry.items.map((item, idx) => {
                  const product = item.productId ? MOCK_PRODUCTS.find(p => p.id === item.productId) : null;
                  
                  return (
                    <div key={idx} className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                      <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-[#1a1a1a] text-lg">{item.product}</h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-600">
                              <span className="flex items-center gap-1.5"><span className="font-medium text-neutral-500">Qty:</span> {item.quantity} {item.unit}</span>
                              <span className="flex items-center gap-1.5"><span className="font-medium text-neutral-500">Target:</span> {item.targetPrice ? `₹${item.targetPrice}` : 'N/A'}</span>
                              {product && (
                                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold border border-blue-100/50">
                                  Ref: {product.code}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-white">
                            <tr className="border-b border-neutral-100">
                              <th className="py-3.5 px-5 font-semibold text-neutral-500 w-[40%]">Vendor</th>
                              <th className="py-3.5 px-5 font-semibold text-neutral-500 text-right">Unit Price</th>
                              <th className="py-3.5 px-5 font-semibold text-neutral-500 text-right">Total Price</th>
                              <th className="py-3.5 px-5 font-semibold text-neutral-500 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50">
                            {vendors.filter(v => v.prices[idx] > 0).length === 0 ? (
                               <tr><td colSpan={4} className="py-8 text-center text-neutral-400 text-sm">No vendor prices available for this product.</td></tr>
                            ) : (
                              vendors.filter(v => v.prices[idx] > 0).map(v => (
                                <tr key={v.id} className={`transition-colors hover:bg-neutral-50/80 ${selectedVendorsPerItem[idx] === v.id ? 'bg-blue-50/30 hover:bg-blue-50/50' : ''}`}>
                                  <td className="py-4 px-5 font-medium text-neutral-800">
                                    <div className="flex items-center gap-2">
                                      {v.name}
                                      {selectedVendorsPerItem[idx] === v.id && (
                                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wide">Selected</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-blue-600 hover:underline cursor-pointer flex items-center gap-1.5 mt-1.5 opacity-80 hover:opacity-100">
                                      <Paperclip size={12}/> {v.attachment}
                                    </div>
                                  </td>
                                  <td className="py-4 px-5 text-neutral-600 text-right font-medium">₹{v.prices[idx].toLocaleString()}</td>
                                  <td className="py-4 px-5 text-neutral-600 text-right font-bold text-[#1a1a1a]">₹{(v.prices[idx] * item.quantity).toLocaleString()}</td>
                                  <td className="py-4 px-5 text-center">
                                    {selectedVendorsPerItem[idx] !== v.id && (
                                      <button 
                                        onClick={() => setSelectedVendorsPerItem({...selectedVendorsPerItem, [idx]: v.id})}
                                        className="px-3.5 py-1.5 border border-neutral-200 bg-white text-neutral-600 rounded text-xs font-semibold hover:bg-neutral-50 transition-colors shadow-sm"
                                      >
                                        Select Quote
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <GlassCard intensity="light" className="p-6">
              <h3 className="font-semibold text-base mb-6">Enquiry Timeline</h3>
              <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-200 before:to-transparent">
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-blue-500 text-white shrink-0 shadow z-10">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-neutral-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-[#1a1a1a]">Enquiry Created</span>
                      <span className="text-xs font-medium text-blue-600">Today, 09:00 AM</span>
                    </div>
                    <p className="text-sm text-neutral-600">Enquiry generated by {enquiry.createdBy}</p>
                  </div>
                </div>
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-neutral-200 text-neutral-500 shrink-0 shadow z-10">
                    <div className="w-2 h-2 bg-neutral-400 rounded-full"></div>
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-neutral-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-[#1a1a1a]">Internal Review</span>
                      <span className="text-xs font-medium text-neutral-500">Pending</span>
                    </div>
                    <p className="text-sm text-neutral-600">Waiting for review by Technical Team</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Procurement Tab */}
          {activeTab === 'procurement' && (
            <GlassCard intensity="light" className="p-6">
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-600">
                  <LinkIcon size={24} />
                </div>
                <h3 className="text-lg font-bold text-neutral-800 mb-2">Supplier Sourcing Required?</h3>
                <p className="text-sm text-neutral-500 max-w-sm mb-6">
                  If products are not available internally, initiate RFQ to suppliers.
                </p>
                <button className="px-5 py-2.5 bg-[#1a1a1a] text-white rounded-lg text-sm font-medium hover:bg-black transition-colors shadow-sm">
                  Create Supplier RFQ
                </button>
              </div>
            </GlassCard>
          )}

        </div>
      </div>
    </div>
  );
}
