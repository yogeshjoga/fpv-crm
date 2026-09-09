import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200/50 mt-4">
      <div className="text-sm text-neutral-500">
        Showing <span className="font-medium text-neutral-900">{startItem}</span> to <span className="font-medium text-neutral-900">{endItem}</span> of <span className="font-medium text-neutral-900">{totalItems}</span> results
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => onPageChange(i + 1)}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                currentPage === i + 1 
                  ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
