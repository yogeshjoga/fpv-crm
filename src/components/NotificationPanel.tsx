import React, { useState } from 'react';
import { useNotifications, NotificationType } from '../context/NotificationContext';
import { X, Bell, CheckCircle2, MessageSquare, Clock, AlertCircle } from 'lucide-react';

export function NotificationPanel() {
  const { notifications, isPanelOpen, closePanel, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<'ALL' | NotificationType>('ALL');

  if (!isPanelOpen) return null;

  const filteredNotifications = notifications.filter(n => filter === 'ALL' || n.type === filter);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'MENTION': return <MessageSquare size={16} className="text-blue-500" />;
      case 'REMINDER': return <Clock size={16} className="text-orange-500" />;
      case 'SYSTEM': return <AlertCircle size={16} className="text-purple-500" />;
      default: return <Bell size={16} className="text-neutral-500" />;
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
        onClick={closePanel}
      />
      
      <div className="fixed top-0 right-0 bottom-0 w-[400px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 border-l border-neutral-200">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-[#1a1a1a]">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                {unreadCount} New
              </span>
            )}
          </div>
          <button 
            onClick={closePanel}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(['ALL', 'SYSTEM', 'MENTION', 'REMINDER'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === f 
                  ? 'bg-[#1a1a1a] text-white' 
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-neutral-50/50 p-2">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-neutral-400">
              <Bell size={24} className="mb-2 opacity-50" />
              <p className="text-sm">No notifications found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredNotifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    notification.read 
                      ? 'bg-white border-neutral-100 opacity-70' 
                      : 'bg-white border-blue-100 shadow-sm'
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      notification.read ? 'bg-neutral-50' : 'bg-blue-50'
                    }`}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold truncate pr-2 ${notification.read ? 'text-neutral-700' : 'text-[#1a1a1a]'}`}>
                          {notification.title}
                        </span>
                        <span className="text-[10px] font-medium text-neutral-400 whitespace-nowrap">
                          {notification.date}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {unreadCount > 0 && (
          <div className="p-4 border-t border-neutral-100 bg-white">
            <button 
              onClick={markAllAsRead}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <CheckCircle2 size={16} />
              Mark all as read
            </button>
          </div>
        )}
      </div>
    </>
  );
}
