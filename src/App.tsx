/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { StatHeader } from './components/StatHeader';
import { InteractionHistory } from './components/InteractionHistory';
import { TasksSchedule } from './components/TasksSchedule';
import { StageFunnel } from './components/StageFunnel';
import { ProfilePanel } from './components/ProfilePanel';
import { LeadWidget } from './components/LeadWidget';
import { Workspace, SIDEBAR_CONFIG } from './config/navigation';
import { Construction } from 'lucide-react';
import { BusinessPartners } from './pages/BusinessPartners';
import { Enquiries } from './pages/Enquiries';

import { Products } from './pages/Products';
import { Administrator } from './pages/Administrator';
import { Leads } from './pages/Leads';
import { Analytics } from './pages/Analytics';
import { NotificationProvider } from './context/NotificationContext';
import QuotationModule from './pages/Quotation';
import { NotificationPanel } from './components/NotificationPanel';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';

export default function App() {
  const { isLoggedIn } = useAuth();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>('Home');
  const [activePage, setActivePage] = useState<string>('Dashboard');

  // When workspace changes, switch to its first page by default if current page is not in the new workspace
  useEffect(() => {
    if (!isLoggedIn) return;
    const pagesInWorkspace = SIDEBAR_CONFIG[activeWorkspace].map(p => p.title);
    if (!pagesInWorkspace.includes(activePage)) {
      setActivePage(SIDEBAR_CONFIG[activeWorkspace][0].title);
    }
  }, [activeWorkspace, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        if (customEvent.detail.workspace) {
          setActiveWorkspace(customEvent.detail.workspace);
        }
        if (customEvent.detail.page) {
          setActivePage(customEvent.detail.page);
        }
      }
    };
    window.addEventListener('crm-navigate-to-page', handleNavigate);
    return () => window.removeEventListener('crm-navigate-to-page', handleNavigate);
  }, [activePage, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <NotificationProvider>
        <LoginScreen />
      </NotificationProvider>
    );
  }


  // Determine if we should show the full dashboard components
  const isDashboard = activePage === 'Dashboard';
  const isSchedule = activePage === 'Schedule';
  const isLeads = activePage === 'Leads';
  const isAdministrator = activePage === 'Administrator' || activePage === 'Administration';
  const isBusinessPartners = activePage === 'Business Partners' || activePage === 'Business Partner';
  const isEnquiries = activePage === 'Enquiries' || activePage === 'Enquiry';
  const isProducts = activePage === 'Products';
  const isQuotation = activePage === 'Quotation';
  const isAnalytics = activeWorkspace === 'Analytics' && activePage === 'Overview';

  return (
    <NotificationProvider>
      <NotificationPanel />
    <div className="h-screen relative overflow-hidden selection:bg-blue-200 flex flex-col">
      <Sidebar activeWorkspace={activeWorkspace} activePage={activePage} setActivePage={setActivePage} />
      <div className="md:pl-28 flex flex-col h-full">
        <div className="px-6 md:px-8 shrink-0 border-b border-black/[0.05]">
          <TopNav activeWorkspace={activeWorkspace} setActiveWorkspace={setActiveWorkspace} />
        </div>
        
        <main className="flex-1 overflow-y-auto px-6 md:px-8 pt-6 pb-10">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-[1600px] mx-auto">
            {isDashboard ? (
            <>
              {/* Left Main Content */}
              <div className="xl:col-span-2 flex flex-col gap-6">
                <StatHeader title={activePage} />
                
                {/* Recent Enquiries (Primary CRM Section) */}
                <InteractionHistory />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                  <TasksSchedule />
                  <StageFunnel />
                </div>
              </div>
              
              {/* Right Sidebar Content */}
              <div className="xl:col-span-1 mt-8 xl:mt-0 flex flex-col gap-6">
                {/* Lead Management Hub */}
                <LeadWidget />
                
                {/* Action Center / Profile Panel */}
                <ProfilePanel />
              </div>
            </>
          ) : isSchedule ? (
            <div className="xl:col-span-3">
              <TasksSchedule isPage={true} />
            </div>
          ) : isAnalytics ? (
            <div className="xl:col-span-3">
              <Analytics />
            </div>
          ) : isLeads ? (
            <div className="xl:col-span-3">
              <Leads />
            </div>
          ) : isAdministrator ? (
            <div className="xl:col-span-3">
              <Administrator />
            </div>
          ) : isBusinessPartners ? (
            <div className="xl:col-span-3">
              <BusinessPartners />
            </div>
          ) : isEnquiries ? (
            <div className="xl:col-span-3">
              <Enquiries />
            </div>
          ) : isProducts ? (
            <div className="xl:col-span-3">
              <Products />
            </div>
          ) : isQuotation ? (
            <div className="xl:col-span-3">
              <QuotationModule />
            </div>
          ) : (
            <div className="xl:col-span-3 flex flex-col items-center justify-center min-h-[60vh] bg-white/30 backdrop-blur-md border border-white/60 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 text-center mt-6">
              <div className="w-24 h-24 bg-white/50 rounded-full flex items-center justify-center mb-8 shadow-sm border border-white/60 text-blue-500">
                <Construction size={48} strokeWidth={1.5} />
              </div>
              <h2 className="font-display text-4xl font-semibold text-[#1a1a1a] mb-4">{activePage}</h2>
              <p className="text-neutral-600 max-w-lg text-lg leading-relaxed">
                The <span className="font-semibold text-neutral-900">{activePage}</span> interface is currently under construction. This module will be available in the next deployment phase.
              </p>
              <button 
                onClick={() => setActivePage(SIDEBAR_CONFIG[activeWorkspace][0].title)}
                className="mt-10 px-8 py-3.5 bg-[#1a1a1a] text-white rounded-full font-medium hover:bg-black transition-colors shadow-lg"
              >
                Return to Dashboard
              </button>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
    </NotificationProvider>
  );
}
