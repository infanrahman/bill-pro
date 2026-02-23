import React from 'react';
import { useKeyboard } from '../../../contexts/KeyboardContext';
import { Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const KeyboardShortcutsTab: React.FC = () => {
    const { shortcuts } = useKeyboard();
    const { t } = useTranslation();

    // Grouping could be added later, for now flat list
    // Or hardcoded list of "Standard" shortcuts + dynamic ones?
    // Let's rely on registered shortcuts for now, but also maybe document the QuickPay flow which is hardcoded in the modal.

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <Keyboard className="text-blue-500" /> {t('settings.tabs.shortcuts') || 'Keyboard Shortcuts'}
            </h2>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Action</th>
                            <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Shortcut</th>
                            <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Context</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-6 py-4 dark:text-slate-300">Open Quick Payment</td>
                            <td className="px-6 py-4">
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono dark:text-white">
                                    F9
                                </kbd>
                            </td>
                            <td className="px-6 py-4 text-slate-500">Global</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-6 py-4 dark:text-slate-300">Move Focus / Next Field</td>
                            <td className="px-6 py-4">
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono dark:text-white">
                                    Enter
                                </kbd>
                            </td>
                            <td className="px-6 py-4 text-slate-500">Inputs</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-6 py-4 dark:text-slate-300">Print / Save Invoice</td>
                            <td className="px-6 py-4">
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono dark:text-white">
                                    Ctrl
                                </kbd>
                                +
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono dark:text-white">
                                    Enter
                                </kbd>
                            </td>
                            <td className="px-6 py-4 text-slate-500">Quick Pay Modal</td>
                        </tr>
                        {shortcuts.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-6 py-4 dark:text-slate-300">{s.description}</td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-1">
                                        {s.keys.map((k, i) => (
                                            <kbd key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono dark:text-white">
                                                {k}
                                            </kbd>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{s.scope || 'Global'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Tally-like Navigation</h3>
                <p className="text-sm text-blue-800 dark:text-blue-400">
                    The Quick Payment modal is designed for speed. Use <kbd className="font-bold">Enter</kbd> to move from Item Name → Amount → Add Item.
                    Once items are added, press <kbd className="font-bold">Ctrl + Enter</kbd> (or F10) to Print & Pay instantly.
                </p>
            </div>
        </div>
    );
};

export default KeyboardShortcutsTab;
