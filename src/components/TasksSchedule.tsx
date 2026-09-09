import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  MoreHorizontal, 
  Calendar, 
  Clock, 
  User, 
  Building2, 
  CheckSquare, 
  Phone, 
  Mail, 
  FileText, 
  Search, 
  Plus, 
  X, 
  ArrowUpRight, 
  Filter, 
  AlertCircle,
  Users,
  CheckCircle2,
  ListCollapse
} from 'lucide-react';
import { GlassCard } from './ui/shared';
import { getTasks, saveTasks, getEnquiries, getActivities, saveActivities, Task, CRMActivity } from '../utils/crmStore';
import { MOCK_PARTNERS } from '../data/mockData';
import { useNotifications } from '../context/NotificationContext';

interface CalendarEvent {
  id: string;
  type: 'task' | 'enquiry' | 'call' | 'note' | 'visit' | 'meeting';
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  dateStr: string;
  timeStr?: string;
  assignee?: string;
  enquiryId?: number;
  originalItem: any;
}

export function TasksSchedule({ isPage = false }: { isPage?: boolean }) {
  const { addNotification } = useNotifications();
  
  // Date States - initialized to current date (July 2026)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 21)); // July 21, 2026
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 6, 21));
  const [isExpanded, setIsExpanded] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isDayEventsPopupOpen, setIsDayEventsPopupOpen] = useState(false);
  
  // Data States
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  
  // Filter States for Expanded Modal
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'task' | 'enquiry' | 'call' | 'note'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'High' | 'Critical' | 'Medium' | 'Low'>('all');

  // Quick Add Form States
  const [quickType, setQuickType] = useState<'task' | 'call' | 'note'>('task');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickEnquiryId, setQuickEnquiryId] = useState<number | undefined>(undefined);
  const [quickPriority, setQuickPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [quickTime, setQuickTime] = useState('10:00');

  // Load and map all data dynamically
  const loadCalendarData = () => {
    const allTasks = getTasks();
    const allEnquiries = getEnquiries();
    const allActivities = getActivities();

    setTasks(allTasks);
    setEnquiries(allEnquiries);
    setActivities(allActivities);

    const mappedEvents: CalendarEvent[] = [];

    // 1. Map Tasks
    allTasks.forEach(t => {
      mappedEvents.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.title,
        description: t.completed ? 'Completed task' : `Pending task assigned to ${t.assignee}`,
        priority: t.priority as any,
        dateStr: t.dueDate,
        assignee: t.assignee,
        enquiryId: t.enquiryId,
        originalItem: t
      });
    });

    // 2. Map Enquiries (Required By Date)
    allEnquiries.forEach(e => {
      if (e.requiredByDate) {
        const company = MOCK_PARTNERS.find(p => p.id === e.companyId)?.name || 'Unknown Client';
        mappedEvents.push({
          id: `enquiry-${e.id}`,
          type: 'enquiry',
          title: `Enquiry Due: ${e.enquiryNumber}`,
          description: `${e.title} • Client: ${company}`,
          priority: e.priority as any,
          dateStr: e.requiredByDate,
          assignee: e.assignedTo,
          enquiryId: e.id,
          originalItem: e
        });
      }
    });

    // 3. Map Activities (Follow-up Dates)
    allActivities.forEach(a => {
      if (a.followUpDate) {
        let type: 'call' | 'note' | 'visit' | 'meeting' = 'note';
        if (a.type === 'Log Call') type = 'call';
        else if (a.type === 'Log Visit') type = 'visit';
        else if (a.type === 'Log Meeting') type = 'meeting';

        const datePart = a.followUpDate.split('T')[0];
        const timePart = a.followUpDate.split('T')[1] || '';

        const formattedTime = timePart 
          ? new Date(a.followUpDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined;

        mappedEvents.push({
          id: `activity-${a.id}`,
          type,
          title: `${a.type === 'Log Call' ? 'Scheduled Follow-up Call' : a.type === 'Add Note' ? 'Future Follow-up Note' : a.title}`,
          description: a.description,
          priority: 'Medium',
          dateStr: datePart,
          timeStr: formattedTime,
          enquiryId: a.enquiryId,
          originalItem: a
        });
      }
    });

    setEvents(mappedEvents);
  };

  useEffect(() => {
    loadCalendarData();
    
    // Refresh whenever crm store is updated
    window.addEventListener('crm-store-update', loadCalendarData);
    return () => window.removeEventListener('crm-store-update', loadCalendarData);
  }, []);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleToday = () => {
    const today = new Date(2026, 6, 21); // Keep localized default
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Build calendar matrix
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const calendarCells = [];

  // Previous month padding cells
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayVal = prevMonthDays - i;
    const prevMonthDate = new Date(currentYear, currentMonth - 1, dayVal);
    calendarCells.push({
      day: dayVal,
      date: prevMonthDate,
      isCurrentMonth: false
    });
  }

  // Current month cells
  for (let i = 1; i <= daysInMonth; i++) {
    const currDate = new Date(currentYear, currentMonth, i);
    calendarCells.push({
      day: i,
      date: currDate,
      isCurrentMonth: true
    });
  }

  // Next month padding cells to complete a perfect grid
  const totalCells = Math.ceil(calendarCells.length / 7) * 7;
  const nextMonthPadding = totalCells - calendarCells.length;
  for (let i = 1; i <= nextMonthPadding; i++) {
    const nextMonthDate = new Date(currentYear, currentMonth + 1, i);
    calendarCells.push({
      day: i,
      date: nextMonthDate,
      isCurrentMonth: false
    });
  }

  // Format Helper
  const formatDateStr = (d: Date) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  };

  const padZero = (n: number) => String(n).padStart(2, '0');

  // Filter events for selected date
  const selectedDateStr = formatDateStr(selectedDate);
  const selectedDayEvents = events.filter(e => e.dateStr === selectedDateStr);

  // Floating user mapping for aesthetic styling matching the design
  const getAvatarForEvent = (event: CalendarEvent) => {
    if (event.assignee?.includes('Roop')) {
      const saved = localStorage.getItem('sp_crm_user_profile');
      if (saved) {
        try {
          return JSON.parse(saved).avatar;
        } catch (e) {}
      }
      return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80';
    } else if (event.assignee?.includes('Yaseen')) {
      return 'https://i.pravatar.cc/150?img=12'; // Yaseen
    } else if (event.assignee?.includes('Sales Team A')) {
      return 'https://i.pravatar.cc/150?img=33'; // Sales Team
    }
    return 'https://i.pravatar.cc/150?img=47';
  };

  // Navigation Deep Link to the target page/tab in the app
  const handleNavigateToEvent = (event: CalendarEvent) => {
    setIsDayEventsPopupOpen(false);
    if (event.enquiryId) {
      localStorage.setItem('crm_goto_enquiry', event.enquiryId.toString());
      
      // Set active tab based on event type
      let tab = 'details';
      if (event.type === 'task') {
        tab = 'tasks';
      } else if (['call', 'note', 'visit', 'meeting'].includes(event.type)) {
        tab = 'activities';
      }
      localStorage.setItem('crm_goto_enquiry_tab', tab);
      
      // Dispatch navigation event
      window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
        detail: { workspace: 'Home', page: 'Enquiry' }
      }));
      
      // Dispatch store update to trigger the route change
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('crm-store-update'));
      }, 50);

      setIsExpanded(false);
    } else {
      addNotification({
        type: 'SYSTEM',
        title: 'Event details',
        message: `${event.title}: ${event.description}`
      });
    }
  };

  // Quick event adding
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    const dateStr = formatDateStr(selectedDate);

    if (quickType === 'task') {
      const allTasks = getTasks();
      const newTask: Task = {
        id: Date.now(),
        enquiryId: quickEnquiryId,
        title: quickTitle,
        assignee: 'Roop Raman',
        priority: quickPriority,
        dueDate: dateStr,
        completed: false,
        setReminder: true
      };
      saveTasks([...allTasks, newTask]);
      addNotification({
        type: 'SUCCESS',
        title: 'Task Scheduled',
        message: `Task scheduled for ${dateStr}`
      });
    } else {
      const allActivities = getActivities();
      const newActivity: CRMActivity = {
        id: Date.now(),
        enquiryId: quickEnquiryId || 1, // fallback to Enquiry 1
        type: quickType === 'call' ? 'Log Call' : 'Add Note',
        title: quickType === 'call' ? 'Scheduled Call' : 'Follow-up Note',
        timestamp: 'Just now',
        description: quickDesc || quickTitle,
        attachment: null,
        followUpDate: `${dateStr}T${quickTime}`
      };
      saveActivities([...allActivities, newActivity]);
      addNotification({
        type: 'SUCCESS',
        title: 'Activity Scheduled',
        message: `${quickType === 'call' ? 'Call' : 'Note'} follow-up set for ${dateStr}`
      });
    }

    // Reset Form
    setQuickTitle('');
    setQuickDesc('');
    setIsQuickAddOpen(false);
    loadCalendarData();
  };

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Colors and visual styling helpers based on day's events
  const getDayEventSummary = (cellDate: Date) => {
    const cStr = formatDateStr(cellDate);
    const dayEvs = events.filter(e => e.dateStr === cStr);
    
    const hasEnquiry = dayEvs.some(e => e.type === 'enquiry');
    const hasTask = dayEvs.some(e => e.type === 'task');
    const hasCall = dayEvs.some(e => e.type === 'call');
    const hasNote = dayEvs.some(e => ['note', 'visit', 'meeting'].includes(e.type));

    return {
      count: dayEvs.length,
      hasEnquiry,
      hasTask,
      hasCall,
      hasNote,
      events: dayEvs
    };
  };

  // Filter events in timeline view (Full pop-up)
  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || 
                        (filterType === 'task' && e.type === 'task') ||
                        (filterType === 'enquiry' && e.type === 'enquiry') ||
                        (filterType === 'call' && e.type === 'call') ||
                        (filterType === 'note' && ['note', 'visit', 'meeting'].includes(e.type));

    const matchesPriority = filterPriority === 'all' || e.priority === filterPriority;

    return matchesSearch && matchesType && matchesPriority;
  }).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  if (isPage) {
    return (
      <GlassCard intensity="light" className="w-full flex flex-col h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 bg-white/40 border-b border-white/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
                  detail: { workspace: 'Home', page: 'Dashboard' }
                }));
              }}
              className="w-10 h-10 rounded-full bg-white/50 hover:bg-white/80 border border-white/60 shadow-sm flex items-center justify-center text-neutral-700 transition-all shrink-0"
              title="Back to Dashboard"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100 shrink-0">
                <Calendar size={20} />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-neutral-800">Unified Schedule Workspace</h2>
                <p className="text-xs text-neutral-500 font-medium">Synchronizing Enquiries, Tasks, and Customer Logs</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Filter Bar */}
        <div className="px-8 py-4 bg-white/30 border-b border-white/20 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
          {/* Type Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
            {[
              { id: 'all', label: 'All Items', icon: <ListCollapse size={14} /> },
              { id: 'task', label: 'Pending Tasks', icon: <CheckSquare size={14} /> },
              { id: 'enquiry', label: 'Enquiry Deadlines', icon: <Building2 size={14} /> },
              { id: 'call', label: 'Scheduled Calls', icon: <Phone size={14} /> },
              { id: 'note', label: 'Follow-up Notes', icon: <FileText size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  filterType === tab.id
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'bg-white/40 border border-white/50 text-neutral-600 hover:bg-white/60'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Priority & Search */}
          <div className="flex gap-3 w-full md:w-auto shrink-0">
            <div className="relative flex-1 md:w-64">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search events, clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white/40 border border-white/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-medium text-neutral-800 placeholder-neutral-500"
              />
            </div>
            
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="px-3 py-2 bg-white/40 border border-white/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold text-neutral-700"
            >
              <option value="all">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {/* Split Content: Calendar left, Detailed Timeline list right */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Column: Calendar Workspace */}
          <div className="w-full md:w-[42%] border-r border-white/20 bg-white/20 p-6 flex flex-col justify-between overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-neutral-800 text-base">Date Select Matrix</h3>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-8 h-8 rounded-full bg-white/50 hover:bg-white/80 flex items-center justify-center border border-white/60 shadow-sm transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-bold text-neutral-800 min-w-[100px] text-center">
                    {monthNames[currentMonth]} {currentYear}
                  </span>
                  <button 
                    type="button"
                    onClick={handleNextMonth}
                    className="w-8 h-8 rounded-full bg-white/50 hover:bg-white/80 flex items-center justify-center border border-white/60 shadow-sm transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Big Grid Labels */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-neutral-400 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(l => <div key={l}>{l}</div>)}
              </div>

              {/* Big Grid numbers */}
              <div className="grid grid-cols-7 gap-y-3 gap-x-2 text-center text-sm">
                {calendarCells.map((cell, idx) => {
                  const cellStr = formatDateStr(cell.date);
                  const isSelected = selectedDateStr === cellStr;
                  const summary = getDayEventSummary(cell.date);

                  let cellBg = '';
                  let textStyle = 'text-neutral-700';

                  if (!cell.isCurrentMonth) {
                    textStyle = 'text-neutral-400/50';
                  } else if (isSelected) {
                    cellBg = 'bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100';
                    textStyle = 'text-white font-bold';
                  } else if (summary.count > 0) {
                    if (summary.hasEnquiry || summary.hasTask) {
                      cellBg = 'bg-blue-50/70 border border-blue-200/50 text-blue-700 rounded-2xl';
                      textStyle = 'text-blue-700 font-semibold';
                    } else if (summary.hasCall) {
                      cellBg = 'bg-teal-50/70 border border-teal-200/50 text-teal-700 rounded-2xl';
                      textStyle = 'text-teal-700 font-semibold';
                    } else {
                      cellBg = 'bg-yellow-50/70 border border-yellow-200/50 text-amber-800 rounded-2xl';
                      textStyle = 'text-amber-800 font-semibold';
                    }
                  } else {
                    cellBg = 'hover:bg-white/40 rounded-2xl';
                  }

                  return (
                    <div
                      key={`expanded-${cellStr}-${idx}`}
                      onClick={() => setSelectedDate(cell.date)}
                      className={`relative py-3 cursor-pointer transition-all ${cellBg} flex flex-col items-center justify-center min-h-[50px]`}
                    >
                      <span className={`text-xs ${textStyle}`}>{cell.day}</span>
                      
                      {/* Dot count indicators */}
                      {summary.count > 0 && (
                        <div className="flex gap-0.5 mt-1 justify-center">
                          {summary.hasTask && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>}
                          {summary.hasEnquiry && <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>}
                          {summary.hasCall && <div className="w-1.5 h-1.5 bg-teal-500 rounded-full"></div>}
                          {summary.hasNote && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left pane quick summary panel */}
            <div className="mt-8 p-5 bg-white/30 rounded-[1.5rem] border border-white/40">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Quick Legend</h4>
                <span className="text-[10px] font-bold text-neutral-400">Color Index</span>
              </div>
              <div className="space-y-2 text-xs font-medium text-neutral-600">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Pending Tasks (Assigned in CRM)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>Enquiry Deadlines (Required Dates)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                  <span>Scheduled Follow-up Calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span>Future Site Visits & Notes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Filtered Timeline view (THE MAIN ASK) */}
          <div className="flex-1 bg-white/10 p-6 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-display font-semibold text-lg text-neutral-800">
                {filterType === 'all' ? 'Comprehensive Master Timeline' : 'Filtered Schedule Items'}
              </h3>
              <span className="text-xs text-neutral-500 font-bold uppercase tracking-wide bg-white/40 px-3 py-1 rounded-full border border-white/50">
                {filteredEvents.length} Items found
              </span>
            </div>

            {/* Timeline list container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/40 border border-white/50 rounded-3xl p-8 text-center">
                  <AlertCircle className="text-neutral-400 mb-3" size={48} strokeWidth={1.5} />
                  <h4 className="font-semibold text-neutral-700 text-base">No scheduled items found</h4>
                  <p className="text-neutral-500 text-xs mt-1 max-w-sm">
                    No follow-up dates, tasks, or enquiries matched your filters. Adjust filters or search terms.
                  </p>
                </div>
              ) : (
                filteredEvents.map((ev, index) => {
                  const parsedDate = new Date(ev.dateStr);
                  const formattedDate = parsedDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
                  
                  let colorBorder = 'border-blue-500';
                  let label = 'Task';
                  let icon = <CheckSquare size={16} />;
                  let priorityColor = 'bg-neutral-100 text-neutral-600 border-neutral-200';

                  if (ev.type === 'enquiry') {
                    colorBorder = 'border-yellow-500';
                    label = 'Enquiry Deadline';
                    icon = <Building2 size={16} />;
                  } else if (ev.type === 'call') {
                    colorBorder = 'border-teal-500';
                    label = 'Scheduled Call';
                    icon = <Phone size={16} />;
                  } else if (ev.type === 'note') {
                    colorBorder = 'border-amber-500';
                    label = 'Future Note';
                    icon = <FileText size={16} />;
                  } else if (ev.type === 'visit') {
                    colorBorder = 'border-orange-500';
                    label = 'Site Visit';
                    icon = <Users size={16} />;
                  } else if (ev.type === 'meeting') {
                    colorBorder = 'border-purple-500';
                    label = 'Client Alignment';
                    icon = <Users size={16} />;
                  }

                  if (ev.priority === 'Critical') {
                    priorityColor = 'bg-red-50 text-red-700 border-red-100';
                  } else if (ev.priority === 'High') {
                    priorityColor = 'bg-orange-50 text-orange-700 border-orange-100';
                  } else if (ev.priority === 'Medium') {
                    priorityColor = 'bg-blue-50 text-blue-700 border-blue-100';
                  }

                  return (
                    <div 
                      key={ev.id}
                      onClick={() => handleNavigateToEvent(ev)}
                      className={`p-5 bg-white/60 hover:bg-white/85 border-l-4 ${colorBorder} border border-white/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group hover:shadow-md transition-all`}
                    >
                      {/* Event info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center shrink-0 border border-white/40 text-neutral-500">
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{label}</span>
                            {ev.priority && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityColor}`}>
                                {ev.priority}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-neutral-800 truncate mt-1 group-hover:text-blue-600 transition-colors">
                            {ev.title}
                          </h4>
                          <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                            {ev.description}
                          </p>
                        </div>
                      </div>

                      {/* Event date/time actions */}
                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-white/20">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-xs font-bold text-neutral-700 justify-end">
                            <Calendar size={12} className="text-neutral-400" />
                            <span>{formattedDate}</span>
                          </div>
                          {ev.timeStr ? (
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 justify-end mt-0.5">
                              <Clock size={10} className="text-neutral-400" />
                              <span>{ev.timeStr}</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-neutral-400 font-medium text-right mt-0.5">All Day Slot</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <img 
                            src={getAvatarForEvent(ev)} 
                            className="w-8 h-8 rounded-full border border-neutral-200 shadow-sm" 
                            alt="" 
                            title={ev.assignee || 'Assigned Agent'}
                          />
                          <div className="w-8 h-8 rounded-full bg-white/40 group-hover:bg-blue-50 flex items-center justify-center border border-white/50 group-hover:border-blue-200 group-hover:text-blue-600 text-neutral-400 transition-all">
                            <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </GlassCard>
    );
  }

  return (
    <>
      {/* Primary Dashboard Mini Calendar View */}
      <GlassCard className="p-6 h-full flex flex-col justify-between select-none min-h-[380px] relative">
        <div>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200/60 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-100/80 text-violet-800 border border-violet-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                <Calendar size={16} />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-[#1a1a1a] truncate">Schedule Desk</h2>
                <p className="text-xs text-neutral-500 font-medium truncate">Upcoming events & task reminders</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-semibold rounded-full bg-white border border-neutral-200/80 text-neutral-700 hover:bg-neutral-100 transition-all shadow-2xs"
                title="Jump to today"
              >
                Today
              </button>
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('crm-navigate-to-page', {
                    detail: { workspace: 'Home', page: 'Schedule' }
                  }));
                }}
                className="w-8 h-8 rounded-full bg-white border border-neutral-200/80 flex items-center justify-center text-neutral-700 hover:text-black hover:bg-neutral-100 transition-all shadow-2xs"
                title="Expand schedule workspace"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* Month Indicator & Switcher */}
          <div className="flex items-center justify-between mb-4 px-1 shrink-0">
            <div className="flex gap-1">
              <button 
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center border border-neutral-200 shadow-sm"
              >
                <ChevronLeft size={16} className="text-neutral-600" />
              </button>
              <button 
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center border border-neutral-200 shadow-sm"
              >
                <ChevronRight size={16} className="text-neutral-600" />
              </button>
            </div>
            <h3 className="font-display font-semibold text-base text-neutral-900">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <button 
              onClick={() => setIsQuickAddOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {/* Day Names Labels */}
          <div className="grid grid-cols-7 gap-x-1 mb-2 text-center text-xs font-bold text-neutral-400">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(label => (
              <div key={label} className="py-1">{label}</div>
            ))}
          </div>

          {/* Calendar Grid Numbers */}
          <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center text-sm relative">
            {calendarCells.map((cell, idx) => {
              const cellDateStr = formatDateStr(cell.date);
              const isSelected = selectedDateStr === cellDateStr;
              
              // Get events count/types
              const summary = getDayEventSummary(cell.date);
              
              // Custom design approximation blobs:
              // Blue for enquiries / tasks, Yellow for notes/visits, Teal for calls
              let dayBlobClass = '';
              let textClass = 'text-neutral-700';

              if (!cell.isCurrentMonth) {
                textClass = 'text-neutral-300';
              } else if (isSelected) {
                dayBlobClass = 'bg-neutral-900 text-white rounded-full scale-95 shadow-md';
                textClass = 'text-white font-bold';
              } else if (summary.count > 0) {
                if (summary.hasEnquiry || summary.hasTask) {
                  dayBlobClass = 'bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-2xl';
                  textClass = 'text-blue-700 font-semibold';
                } else if (summary.hasCall) {
                  dayBlobClass = 'bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-2xl';
                  textClass = 'text-teal-700 font-semibold';
                } else {
                  dayBlobClass = 'bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-amber-800 rounded-2xl';
                  textClass = 'text-amber-800 font-semibold';
                }
              }

              return (
                <div 
                  key={`${cellDateStr}-${idx}`} 
                  onClick={() => {
                    setSelectedDate(cell.date);
                    setIsDayEventsPopupOpen(true);
                  }}
                  className={`group relative flex flex-col items-center justify-center h-10 w-10 mx-auto cursor-pointer transition-all ${dayBlobClass}`}
                >
                  <span className={`z-10 text-xs ${textClass}`}>
                    {cell.day}
                  </span>
                  
                  {/* Floating avatar if events present (aesthetics matching design) */}
                  {cell.isCurrentMonth && summary.count > 0 && !isSelected && (
                    <div className="absolute -bottom-1 flex justify-center gap-0.5 z-20">
                      {summary.events.slice(0, 1).map(ev => (
                        <img 
                          key={ev.id}
                          src={getAvatarForEvent(ev)} 
                          className="w-3.5 h-3.5 rounded-full border border-white shadow-xs" 
                          alt="" 
                        />
                      ))}
                    </div>
                  )}

                  {/* Tiny dot indicator if multiple events */}
                  {summary.count > 1 && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </GlassCard>

      {/* QUICK ADD EVENT OVERLAY (MODAL POPUP) */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-neutral-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-800 text-base">
                Schedule for {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </h3>
              <button 
                onClick={() => setIsQuickAddOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase">Schedule Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'task', label: 'Task', icon: <CheckSquare size={14} /> },
                    { value: 'call', label: 'Call Log', icon: <Phone size={14} /> },
                    { value: 'note', label: 'Follow-up Note', icon: <FileText size={14} /> }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuickType(opt.value as any)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        quickType === opt.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase">Title / Subject</label>
                <input 
                  type="text"
                  required
                  placeholder={quickType === 'task' ? 'e.g., Send quote proposal' : 'e.g., Outbound follow-up'}
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm font-medium text-neutral-800"
                />
              </div>

              {quickType !== 'task' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase">Notes / Description</label>
                  <textarea 
                    placeholder="Enter discussion details or reason for follow-up"
                    value={quickDesc}
                    onChange={(e) => setQuickDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm font-medium text-neutral-800 h-20 resize-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase">Associate Enquiry</label>
                  <select
                    value={quickEnquiryId || ''}
                    onChange={(e) => setQuickEnquiryId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold text-neutral-800"
                  >
                    <option value="">-- Optional --</option>
                    {enquiries.map(enq => (
                      <option key={enq.id} value={enq.id}>{enq.enquiryNumber} ({enq.title.substring(0, 15)}...)</option>
                    ))}
                  </select>
                </div>

                {quickType === 'task' ? (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase">Priority</label>
                    <select
                      value={quickPriority}
                      onChange={(e) => setQuickPriority(e.target.value as any)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold text-neutral-800"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase">Time Slot</label>
                    <input 
                      type="time"
                      value={quickTime}
                      onChange={(e) => setQuickTime(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold text-neutral-800"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-bold text-neutral-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-100"
                >
                  Add to Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL EXPANDED CALENDAR & TIMELINE WORKSPACE (MAXIMIZED POPUP DETAILED VIEW) */}
      {isExpanded && (
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-neutral-50 w-full max-w-6xl h-[90vh] md:h-[80vh] rounded-[2.5rem] border border-neutral-200/60 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            
            {/* Header */}
            <div className="px-8 py-5 bg-white border-b border-neutral-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl text-neutral-800">Unified Schedule Workspace</h2>
                  <p className="text-xs text-neutral-400 font-medium">Synchronizing Enquiries, Tasks, and Customer Logs</p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsExpanded(false)}
                className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Controls Filter Bar */}
            <div className="px-8 py-4 bg-white border-b border-neutral-100 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
              {/* Type Filter Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
                {[
                  { id: 'all', label: 'All Items', icon: <ListCollapse size={14} /> },
                  { id: 'task', label: 'Pending Tasks', icon: <CheckSquare size={14} /> },
                  { id: 'enquiry', label: 'Enquiry Deadlines', icon: <Building2 size={14} /> },
                  { id: 'call', label: 'Scheduled Calls', icon: <Phone size={14} /> },
                  { id: 'note', label: 'Follow-up Notes', icon: <FileText size={14} /> }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id as any)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                      filterType === tab.id
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Priority & Search */}
              <div className="flex gap-3 w-full md:w-auto shrink-0">
                <div className="relative flex-1 md:w-64">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search events, clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-medium text-neutral-800"
                  />
                </div>
                
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as any)}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold text-neutral-700"
                >
                  <option value="all">All Priorities</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Split Content: Calendar left, Detailed Timeline list right */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              
              {/* Left Column: Calendar Workspace */}
              <div className="w-full md:w-[42%] border-r border-neutral-200/50 bg-white p-6 flex flex-col justify-between overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-neutral-800 text-base">Date Select Matrix</h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handlePrevMonth}
                        className="w-8 h-8 rounded-full bg-neutral-50 hover:bg-neutral-100 flex items-center justify-center border border-neutral-200"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-bold text-neutral-800 min-w-[100px] text-center">
                        {monthNames[currentMonth]} {currentYear}
                      </span>
                      <button 
                        onClick={handleNextMonth}
                        className="w-8 h-8 rounded-full bg-neutral-50 hover:bg-neutral-100 flex items-center justify-center border border-neutral-200"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Big Grid Labels */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-neutral-400 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(l => <div key={l}>{l}</div>)}
                  </div>

                  {/* Big Grid numbers */}
                  <div className="grid grid-cols-7 gap-y-3 gap-x-2 text-center text-sm">
                    {calendarCells.map((cell, idx) => {
                      const cellStr = formatDateStr(cell.date);
                      const isSelected = selectedDateStr === cellStr;
                      const summary = getDayEventSummary(cell.date);

                      let cellBg = '';
                      let textStyle = 'text-neutral-700';

                      if (!cell.isCurrentMonth) {
                        textStyle = 'text-neutral-300';
                      } else if (isSelected) {
                        cellBg = 'bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100';
                        textStyle = 'text-white font-bold';
                      } else if (summary.count > 0) {
                        if (summary.hasEnquiry || summary.hasTask) {
                          cellBg = 'bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl';
                          textStyle = 'text-blue-700 font-semibold';
                        } else if (summary.hasCall) {
                          cellBg = 'bg-teal-50 border border-teal-200 text-teal-700 rounded-2xl';
                          textStyle = 'text-teal-700 font-semibold';
                        } else {
                          cellBg = 'bg-yellow-50 border border-yellow-200 text-amber-800 rounded-2xl';
                          textStyle = 'text-amber-800 font-semibold';
                        }
                      } else {
                        cellBg = 'hover:bg-neutral-50 rounded-2xl';
                      }

                      return (
                        <div
                          key={`expanded-${cellStr}-${idx}`}
                          onClick={() => setSelectedDate(cell.date)}
                          className={`relative py-3 cursor-pointer transition-all ${cellBg} flex flex-col items-center justify-center min-h-[50px]`}
                        >
                          <span className={`text-xs ${textStyle}`}>{cell.day}</span>
                          
                          {/* Dot count indicators */}
                          {summary.count > 0 && (
                            <div className="flex gap-0.5 mt-1 justify-center">
                              {summary.hasTask && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>}
                              {summary.hasEnquiry && <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>}
                              {summary.hasCall && <div className="w-1.5 h-1.5 bg-teal-500 rounded-full"></div>}
                              {summary.hasNote && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Left pane quick summary panel */}
                <div className="mt-8 p-5 bg-neutral-50 rounded-[1.5rem] border border-neutral-200/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Quick Legend</h4>
                    <span className="text-[10px] font-bold text-neutral-400">Color Index</span>
                  </div>
                  <div className="space-y-2 text-xs font-medium text-neutral-600">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Pending Tasks (Assigned in CRM)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>Enquiry Deadlines (Required Dates)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                      <span>Scheduled Follow-up Calls</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      <span>Future Site Visits & Notes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic Filtered Timeline view (THE MAIN ASK) */}
              <div className="flex-1 bg-neutral-50 p-6 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className="font-display font-semibold text-lg text-neutral-800">
                    {filterType === 'all' ? 'Comprehensive Master Timeline' : 'Filtered Schedule Items'}
                  </h3>
                  <span className="text-xs text-neutral-400 font-bold uppercase tracking-wide bg-white px-3 py-1 rounded-full border border-neutral-100">
                    {filteredEvents.length} Items found
                  </span>
                </div>

                {/* Timeline list container */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-neutral-200/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-track]:bg-transparent">
                  {filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border border-neutral-200/60 rounded-3xl p-8 text-center shadow-xs">
                      <AlertCircle className="text-neutral-300 mb-3" size={48} strokeWidth={1.5} />
                      <h4 className="font-semibold text-neutral-700 text-base">No scheduled items found</h4>
                      <p className="text-neutral-500 text-xs mt-1 max-w-sm">
                        No follow-up dates, tasks, or enquiries matched your filters. Adjust filters or search terms.
                      </p>
                    </div>
                  ) : (
                    filteredEvents.map((ev, index) => {
                      const parsedDate = new Date(ev.dateStr);
                      const formattedDate = parsedDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
                      
                      let colorBorder = 'border-blue-500';
                      let label = 'Task';
                      let icon = <CheckSquare size={16} />;
                      let priorityColor = 'bg-neutral-100 text-neutral-600 border-neutral-200';

                      if (ev.type === 'enquiry') {
                        colorBorder = 'border-yellow-500';
                        label = 'Enquiry Deadline';
                        icon = <Building2 size={16} />;
                      } else if (ev.type === 'call') {
                        colorBorder = 'border-teal-500';
                        label = 'Scheduled Call';
                        icon = <Phone size={16} />;
                      } else if (ev.type === 'note') {
                        colorBorder = 'border-amber-500';
                        label = 'Future Note';
                        icon = <FileText size={16} />;
                      } else if (ev.type === 'visit') {
                        colorBorder = 'border-orange-500';
                        label = 'Site Visit';
                        icon = <Users size={16} />;
                      } else if (ev.type === 'meeting') {
                        colorBorder = 'border-purple-500';
                        label = 'Client Alignment';
                        icon = <Users size={16} />;
                      }

                      if (ev.priority === 'Critical') {
                        priorityColor = 'bg-red-50 text-red-700 border-red-100';
                      } else if (ev.priority === 'High') {
                        priorityColor = 'bg-orange-50 text-orange-700 border-orange-100';
                      } else if (ev.priority === 'Medium') {
                        priorityColor = 'bg-blue-50 text-blue-700 border-blue-100';
                      }

                      return (
                        <div 
                          key={ev.id}
                          onClick={() => handleNavigateToEvent(ev)}
                          className={`p-5 bg-white hover:border-neutral-300 border-l-4 ${colorBorder} border border-neutral-200/60 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200`}
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          {/* Event info */}
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center shrink-0 border border-neutral-100 text-neutral-500">
                              {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{label}</span>
                                {ev.priority && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityColor}`}>
                                    {ev.priority}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-neutral-800 truncate mt-1 group-hover:text-blue-600 transition-colors">
                                {ev.title}
                              </h4>
                              <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                                {ev.description}
                              </p>
                            </div>
                          </div>

                          {/* Event date/time actions */}
                          <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-neutral-100">
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-xs font-bold text-neutral-700 justify-end">
                                <Calendar size={12} className="text-neutral-400" />
                                <span>{formattedDate}</span>
                              </div>
                              {ev.timeStr ? (
                                <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 justify-end mt-0.5">
                                  <Clock size={10} className="text-neutral-400" />
                                  <span>{ev.timeStr}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-neutral-400 font-medium text-right mt-0.5">All Day Slot</div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <img 
                                src={getAvatarForEvent(ev)} 
                                className="w-8 h-8 rounded-full border border-neutral-200 shadow-sm" 
                                alt="" 
                                title={ev.assignee || 'Assigned Agent'}
                              />
                              <div className="w-8 h-8 rounded-full bg-neutral-50 group-hover:bg-blue-50 flex items-center justify-center border border-neutral-200 group-hover:border-blue-200 group-hover:text-blue-600 text-neutral-400 transition-all">
                                <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      {/* GORGEOUS DAY EVENTS OVERLAY (POPUP MODAL) */}
      {isDayEventsPopupOpen && (
        <div className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="text-blue-600 animate-pulse" size={18} />
                <h3 className="font-semibold text-neutral-800 text-sm md:text-base">
                  Schedule: {selectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <button 
                onClick={() => setIsDayEventsPopupOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[50vh] overflow-y-auto space-y-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-neutral-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="text-emerald-500 mb-2 animate-bounce" size={40} />
                  <h4 className="font-semibold text-neutral-800 text-sm">All Clear! No items scheduled</h4>
                  <p className="text-neutral-500 text-xs mt-1 max-w-xs">
                    You have no pending tasks, enquiry deadlines, or follow-up calls for this date.
                  </p>
                </div>
              ) : (
                selectedDayEvents.map(ev => {
                  let colorBorder = 'border-blue-500';
                  let icon = <CheckSquare size={14} />;
                  let label = 'Task';
                  let bgBadge = 'bg-blue-50 text-blue-700';

                  if (ev.type === 'enquiry') {
                    colorBorder = 'border-yellow-500';
                    icon = <Building2 size={14} />;
                    label = 'Enquiry';
                    bgBadge = 'bg-yellow-50 text-amber-700';
                  } else if (ev.type === 'call') {
                    colorBorder = 'border-teal-500';
                    icon = <Phone size={14} />;
                    label = 'Call Log';
                    bgBadge = 'bg-teal-50 text-teal-700';
                  } else if (ev.type === 'note') {
                    colorBorder = 'border-amber-500';
                    icon = <FileText size={14} />;
                    label = 'Note';
                    bgBadge = 'bg-amber-50 text-amber-800';
                  }

                  let priorityColor = 'bg-neutral-100 text-neutral-600';
                  if (ev.priority === 'Critical') priorityColor = 'bg-red-100 text-red-700';
                  else if (ev.priority === 'High') priorityColor = 'bg-orange-100 text-orange-700';
                  else if (ev.priority === 'Medium') priorityColor = 'bg-blue-100 text-blue-700';

                  return (
                    <div 
                      key={ev.id}
                      onClick={() => handleNavigateToEvent(ev)}
                      className={`p-4 bg-neutral-50 hover:bg-neutral-100/70 border-l-4 ${colorBorder} rounded-r-xl border border-neutral-100/80 flex items-start justify-between gap-3 cursor-pointer group hover:shadow-sm transition-all`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-neutral-100 text-neutral-500 shadow-xs">
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${bgBadge}`}>{label}</span>
                            {ev.priority && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${priorityColor}`}>
                                {ev.priority}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs md:text-sm font-bold text-neutral-800 truncate mt-1 group-hover:text-blue-600 transition-colors">
                            {ev.title}
                          </h4>
                          <p className="text-xs text-neutral-500 line-clamp-2 mt-1">
                            {ev.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                        <span className="text-[10px] font-bold text-neutral-400">
                          {ev.timeStr || 'All Day'}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center border border-neutral-200 text-neutral-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                          <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-100 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsDayEventsPopupOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-xs font-bold text-neutral-700 bg-white transition-colors"
              >
                Close Window
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsDayEventsPopupOpen(false);
                  setIsQuickAddOpen(true);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Schedule New
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
