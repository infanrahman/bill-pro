import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, FileText, User, ShoppingCart, Package, Settings, TrendingUp, X, ChevronRight, LayoutDashboard, DollarSign, BookOpen, FileSpreadsheet, Users, ShoppingBag } from 'lucide-react';
import { db } from '../../services/db';

export const CommandPalette: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Results states
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  
  const pages = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'POS', path: '/pos', icon: ShoppingCart },
    { name: 'Inventory / Menu', path: '/inventory', icon: Package },
    { name: 'Sales', path: '/sales', icon: TrendingUp },
    { name: 'Expenses', path: '/expenses', icon: DollarSign },
    { name: 'Purchases', path: '/purchase', icon: ShoppingBag },
    { name: 'Suppliers', path: '/suppliers', icon: Package },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Cash Book', path: '/cash-book', icon: BookOpen },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Spreadsheet', path: '/spreadsheet', icon: FileSpreadsheet },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const filteredPages = query ? pages.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) : pages;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleOpenEvent = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const searchDB = async () => {
      if (!query.trim()) {
        setItems([]);
        setCustomers([]);
        setInvoices([]);
        return;
      }
      const lowerQuery = query.toLowerCase();
      
      try {
        const foundItems = await db.items.filter(i => 
          (i.name || '').toLowerCase().includes(lowerQuery) || 
          (i.barcode || '').toLowerCase().includes(lowerQuery)
        ).limit(5).toArray();
        
        const foundCustomers = await db.customers.filter(c => 
          (c.name || '').toLowerCase().includes(lowerQuery) || 
          (c.phone || '').includes(lowerQuery)
        ).limit(5).toArray();

        const foundInvoices = await db.invoices.filter(i => 
          (i.invoiceNumber || '').toLowerCase().includes(lowerQuery) || 
          (i.customerName || '').toLowerCase().includes(lowerQuery)
        ).limit(5).toArray();

        setItems(foundItems);
        setCustomers(foundCustomers);
        setInvoices(foundInvoices);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Error searching DB", err);
      }
    };

    const debounceId = setTimeout(searchDB, 300);
    return () => clearTimeout(debounceId);
  }, [query]);

  const allResults = [
    ...filteredPages.map(p => ({ ...p, type: 'page' })),
    ...items.map(i => ({ ...i, type: 'item' })),
    ...customers.map(c => ({ ...c, type: 'customer' })),
    ...invoices.map(i => ({ ...i, type: 'invoice' }))
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < allResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex]);
      }
    }
  };

  const handleSelect = (result: any) => {
    setIsOpen(false);
    if (result.type === 'page') {
      navigate(result.path);
    } else if (result.type === 'item') {
      navigate('/inventory');
    } else if (result.type === 'customer') {
      navigate('/customers');
    } else if (result.type === 'invoice') {
      navigate('/sales');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search everything (pages, items, customers, invoices)..."
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-2 flex-1">
          {allResults.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No results found for "{query}"
            </div>
          ) : (
            <div className="space-y-1">
              {allResults.map((result, index) => {
                const isSelected = index === selectedIndex;
                const Icon = result.type === 'page' ? result.icon : 
                             result.type === 'item' ? Package : 
                             result.type === 'customer' ? User : FileText;

                return (
                  <button
                    key={`${result.type}-${result.id || result.path}`}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${
                      isSelected 
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isSelected 
                          ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">
                          {result.type === 'page' ? result.name :
                           result.type === 'item' ? result.name :
                           result.type === 'customer' ? result.name :
                           result.type === 'invoice' ? `Invoice ${result.invoiceNumber}` : ''}
                        </div>
                        <div className="text-xs opacity-70 mt-0.5">
                          {result.type === 'page' ? 'Navigation' :
                           result.type === 'item' ? `SKU: ${result.barcode || 'N/A'}` :
                           result.type === 'customer' ? `Phone: ${result.phone || 'N/A'}` :
                           result.type === 'invoice' ? `Customer: ${result.customerName}` : ''}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[10px]">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[10px]">↵</kbd>
              to select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-[10px]">ESC</kbd>
            to close
          </span>
        </div>
      </div>
      
      {/* Invisible backdrop to close on click outside */}
      <div className="absolute inset-0 z-[-1]" onClick={() => setIsOpen(false)} />
    </div>
  );
};
