import React from 'react';
import { useKeyboard } from '../../../contexts/KeyboardContext';
import { Keyboard, Zap, ShoppingCart, FileSpreadsheet, Layers, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ShortcutGroup {
  category: string;
  icon: React.ElementType;
  items: {
    action: string;
    keys: string[];
    context: string;
    notes?: string;
  }[];
}

const KeyboardShortcutsTab: React.FC = () => {
  const { shortcuts } = useKeyboard();
  const { t } = useTranslation();

  const shortcutGroups: ShortcutGroup[] = [
    {
      category: 'Global & Navigation',
      icon: Terminal,
      items: [
        { action: 'Open POS Terminal', keys: ['F1'], context: 'Global' },
        { action: 'Search Everything (Command Palette)', keys: ['Ctrl', 'K'], context: 'Global' },
        { action: 'Open Quick Payment (Zap)', keys: ['F9'], context: 'Global' },
        { action: 'Open Cash Drawer', keys: ['F8'], context: 'Global' },
        { action: 'Close Modal / Cancel', keys: ['Esc'], context: 'Global Modals' },
        { action: 'Auto-load Sales Order', keys: ['Scan SO-***'], context: 'Global Barcode' },
      ],
    },
    {
      category: 'POS Terminal (/pos)',
      icon: ShoppingCart,
      items: [
        { action: 'Focus Item Search Bar', keys: ['F2'], context: 'POS Terminal' },
        { action: 'Toggle Order Type (Dine-in/Parcel/etc)', keys: ['F8'], context: 'POS Terminal (Cafe Mode)' },
        { action: 'Checkout Order', keys: ['F9'], context: 'POS Terminal' },
        { action: 'Clear Cart', keys: ['Delete'], context: 'POS Terminal' },
        { action: 'Lookup Barcode / Add Item', keys: ['Enter'], context: 'POS Search' },
      ],
    },
    {
      category: 'Quick Payment (Zap)',
      icon: Zap,
      items: [
        { action: 'Print & Pay Invoice', keys: ['Ctrl', 'Enter'], context: 'Quick Pay Modal' },
        { action: 'Print & Pay Invoice (Alt)', keys: ['F10'], context: 'Quick Pay Modal' },
        { action: 'Next Input Field / Add Item', keys: ['Enter'], context: 'Quick Pay Inputs' },
      ],
    },
    {
      category: 'Spreadsheet Editor (/spreadsheet)',
      icon: FileSpreadsheet,
      items: [
        { action: 'Save Spreadsheet', keys: ['Ctrl', 'S'], context: 'Spreadsheet' },
        { action: 'Undo Action', keys: ['Ctrl', 'Z'], context: 'Spreadsheet' },
        { action: 'Redo Action', keys: ['Ctrl', 'Y'], context: 'Spreadsheet' },
        { action: 'Move Selection Right / Left', keys: ['Tab'], context: 'Grid Cells', notes: 'Shift + Tab for left' },
        { action: 'Move Selection Down / Up', keys: ['Enter'], context: 'Grid Cells', notes: 'Shift + Enter for up' },
      ],
    },
    {
      category: 'Navigation & Lists',
      icon: Layers,
      items: [
        { action: 'Navigate Items / Options', keys: ['↑', '↓'], context: 'Sidebar / Command Palette' },
        { action: 'Select Highlighted Item', keys: ['Enter'], context: 'Command Palette / Dropdowns' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
            <Keyboard className="text-slate-900 dark:text-white" />
            {t('settings.tabs.shortcuts') || 'Keyboard Shortcuts'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Reference guide for all keyboard shortcuts available across Billing Pro.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {shortcutGroups.map((group, idx) => {
          const GroupIcon = group.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
            >
              <div className="bg-slate-50 dark:bg-slate-900/60 px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 text-sm">
                <GroupIcon size={16} className="text-slate-600 dark:text-slate-400" />
                <span>{group.category}</span>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 dark:bg-slate-900/30 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50">
                  <tr>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Shortcut Key</th>
                    <th className="px-6 py-3">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {group.items.map((item, itemIdx) => (
                    <tr key={itemIdx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                        {item.action}
                        {item.notes && (
                          <span className="block text-[11px] text-slate-400 font-normal mt-0.5">{item.notes}</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1">
                          {item.keys.map((k, kIdx) => (
                            <React.Fragment key={kIdx}>
                              {kIdx > 0 && <span className="text-slate-400 text-xs font-mono">+</span>}
                              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono text-slate-800 dark:text-slate-100 shadow-xs font-semibold">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {item.context}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {shortcuts.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-50 dark:bg-slate-900/60 px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 text-sm">
              <Keyboard size={16} className="text-slate-600 dark:text-slate-400" />
              <span>Dynamic Registered Shortcuts</span>
            </div>
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {shortcuts.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-200">{s.description}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1">
                        {s.keys.map((k: any, i: any) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-slate-400 text-xs font-mono">+</span>}
                            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono text-slate-800 dark:text-slate-100 shadow-xs font-semibold">
                              {k}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500 dark:text-slate-400 font-medium">{s.scope || 'Global'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
        <Zap className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
        <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <h4 className="font-bold">Fast Keyboard Workflow (Tally-Style)</h4>
          <p>
            In the <strong>Quick Payment (F9)</strong> modal, use <kbd className="font-semibold bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">Enter</kbd> to quickly jump from <em>Item Description → Amount → Add Item</em>. Once items are added, press <kbd className="font-semibold bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">Ctrl + Enter</kbd> (or <kbd className="font-semibold bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">F10</kbd>) to instantly save and print the receipt.
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsTab;
