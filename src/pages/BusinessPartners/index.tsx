import { useState } from 'react';
import { BusinessPartnersList } from './BusinessPartnersList';
import { BusinessPartnerDetail } from './BusinessPartnerDetail';
import { NewBusinessPartner } from './NewBusinessPartner';

export function BusinessPartners() {
  const [view, setView] = useState<'list' | 'detail' | 'new'>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleView = (id: number) => {
    setSelectedId(id);
    setView('detail');
  };

  const handleNew = () => {
    setView('new');
  };

  const handleBack = () => {
    setView('list');
    setSelectedId(null);
  };

  const handleSave = () => {
    // In a real app, save logic here
    setView('list');
  };

  return (
    <div className="w-full">
      {view === 'list' && (
        <BusinessPartnersList onView={handleView} onNew={handleNew} />
      )}
      
      {view === 'detail' && selectedId && (
        <BusinessPartnerDetail partnerId={selectedId} onBack={handleBack} />
      )}
      
      {view === 'new' && (
        <NewBusinessPartner onBack={handleBack} onSave={handleSave} />
      )}
    </div>
  );
}
