import React, { useState, useEffect } from 'react';
import { Quotation } from './types';
import { INITIAL_QUOTATIONS } from './mockQuotations';
import { QuotationList } from './QuotationList';
import { NewQuotation } from './NewQuotation';
import { QuotationDetail } from './QuotationDetail';

const LOCAL_STORAGE_KEY = 'sp_crm_quotations';

export default function QuotationModule() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);

  // Load from local storage or fallback to mock list
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        setQuotations(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse quotations from localStorage", err);
        setQuotations(INITIAL_QUOTATIONS);
      }
    } else {
      setQuotations(INITIAL_QUOTATIONS);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_QUOTATIONS));
    }
  }, []);

  // Helper to persist quotations list
  const persistQuotations = (updatedList: Quotation[]) => {
    setQuotations(updatedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
  };

  // Add or update quotation
  const handleSaveQuotation = (savedQuote: Quotation) => {
    const exists = quotations.some(q => q.id === savedQuote.id);
    let updatedList: Quotation[];
    
    if (exists) {
      updatedList = quotations.map(q => q.id === savedQuote.id ? savedQuote : q);
    } else {
      updatedList = [savedQuote, ...quotations];
    }
    
    persistQuotations(updatedList);
    setSelectedQuoteId(savedQuote.id);
    setView('detail'); // Show the newly saved details!
  };

  // Delete quotation
  const handleDeleteQuotation = (id: number) => {
    const updatedList = quotations.filter(q => q.id !== id);
    persistQuotations(updatedList);
    if (selectedQuoteId === id) {
      setSelectedQuoteId(null);
    }
  };

  // Status Change trigger
  const handleStatusChange = (id: number, status: Quotation['status']) => {
    const updatedList = quotations.map(q => q.id === id ? { ...q, status } : q);
    persistQuotations(updatedList);
  };

  // Find selected quotation
  const activeQuotation = quotations.find(q => q.id === selectedQuoteId);

  if (view === 'new') {
    return (
      <NewQuotation 
        quotationToEdit={activeQuotation}
        onBack={() => {
          setSelectedQuoteId(null);
          setView('list');
        }} 
        onSave={handleSaveQuotation}
      />
    );
  }

  if (view === 'detail' && activeQuotation) {
    return (
      <QuotationDetail 
        quotation={activeQuotation}
        onBack={() => {
          setSelectedQuoteId(null);
          setView('list');
        }}
        onEdit={() => setView('new')}
        onStatusChange={(status) => handleStatusChange(activeQuotation.id, status)}
      />
    );
  }

  return (
    <QuotationList 
      quotations={quotations}
      onNew={() => {
        setSelectedQuoteId(null);
        setView('new');
      }}
      onView={(id) => {
        setSelectedQuoteId(id);
        setView('detail');
      }}
      onEdit={(id) => {
        setSelectedQuoteId(id);
        setView('new');
      }}
      onDelete={handleDeleteQuotation}
      onStatusChange={handleStatusChange}
    />
  );
}
