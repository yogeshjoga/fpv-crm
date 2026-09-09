import React, { useState } from 'react';
import { EnquiriesList } from './EnquiriesList';
import { NewEnquiry } from './NewEnquiry';
import { EnquiryDetail } from './EnquiryDetail';

export function Enquiries() {
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [selectedEnquiry, setSelectedEnquiry] = useState<number | null>(null);

  React.useEffect(() => {
    const checkRedirect = () => {
      const gotoIdStr = localStorage.getItem('crm_goto_enquiry');
      if (gotoIdStr) {
        const id = parseInt(gotoIdStr, 10);
        if (!isNaN(id)) {
          setSelectedEnquiry(id);
          setView('detail');
          localStorage.removeItem('crm_goto_enquiry');
        }
      }
    };
    checkRedirect();
    // Also listen to store updates in case we're already mounted
    window.addEventListener('crm-store-update', checkRedirect);
    return () => window.removeEventListener('crm-store-update', checkRedirect);
  }, []);

  if (view === 'new') {
    return <NewEnquiry onBack={() => setView('list')} onSave={() => setView('list')} />;
  }

  if (view === 'detail' && selectedEnquiry) {
    return <EnquiryDetail enquiryId={selectedEnquiry} onBack={() => setView('list')} />;
  }

  return (
    <EnquiriesList 
      onNew={() => setView('new')} 
      onView={(id) => {
        setSelectedEnquiry(id);
        setView('detail');
      }} 
    />
  );
}
