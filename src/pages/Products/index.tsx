import React, { useState } from 'react';
import { ProductsList } from './ProductsList';
import { NewProduct } from './NewProduct';
import { ProductDetail } from './ProductDetail';

export function Products() {
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);

  if (view === 'new') {
    return <NewProduct onBack={() => setView('list')} onSave={() => setView('list')} />;
  }

  if (view === 'detail' && selectedProduct) {
    return <ProductDetail productId={selectedProduct} onBack={() => setView('list')} />;
  }

  return (
    <ProductsList 
      onNewProduct={() => setView('new')} 
      onViewDetail={(id) => {
        setSelectedProduct(id);
        setView('detail');
      }} 
    />
  );
}
