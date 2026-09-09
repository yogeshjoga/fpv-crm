import React, { createContext, useContext, useState } from 'react';

export type NotificationType = 'SYSTEM' | 'MENTION' | 'REMINDER' | 'GENERAL';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  date: string;
  read: boolean;
  relatedEntityId?: number;
  relatedEntityType?: 'Enquiry' | 'Task' | 'BusinessPartner';
}

interface NotificationContextType {
  notifications: Notification[];
  isPanelOpen: boolean;
  togglePanel: () => void;
  closePanel: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'read'>) => void;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, type: 'REMINDER', title: 'Follow-up Reminder', message: 'Call ACME Corp regarding their RFQ', date: 'Just now', read: false },
    { id: 2, type: 'MENTION', title: 'Mentioned you in Enquiry', message: '@roop please check this quote.', date: '10 mins ago', read: false },
    { id: 3, type: 'SYSTEM', title: 'System Update', message: 'New deployment successfully completed.', date: '1 hr ago', read: true },
  ]);

  const togglePanel = () => setIsPanelOpen(prev => !prev);
  const closePanel = () => setIsPanelOpen(false);

  const addNotification = (notification: Omit<Notification, 'id' | 'read'>) => {
    setNotifications(prev => [{ ...notification, id: Date.now(), read: false }, ...prev]);
  };

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <NotificationContext.Provider value={{ notifications, isPanelOpen, togglePanel, closePanel, addNotification, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
