import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { Settings, Info, Minus, Plus } from 'lucide-react';

const GeneralTab: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const { t, i18n } = useTranslation();

    const currencies = [
        { code: 'USD', symbol: '$', label: 'USD ($)' },
        { code: 'EUR', symbol: '€', label: 'EUR (€)' },
        { code: 'INR', symbol: '₹', label: 'INR (₹)' },
        { code: 'SAR', symbol: '﷼', label: 'SAR (﷼)' },
        { code: 'GBP', symbol: '£', label: 'GBP (£)' },
        { code: 'AED', symbol: 'د.إ', label: 'AED (د.إ)' },
    ];

    const dateFormats = [
        { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy' },
        { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy' },
        { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd' },
    ];

    const handleDecimalChange = (increment: boolean) => {
        const newValue = increment ? settings.decimals + 1 : settings.decimals - 1;
        if (newValue >= 0 && newValue <= 4) {
            updateSettings({ decimals: newValue });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl dark:bg-blue-900/30 dark:text-blue-400">
                    <Settings size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold dark:text-white">{t('settings.general.title')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.general.subtitle')}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Language */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium dark:text-white">{t('settings.general.language_label')}</span>
                            <Info size={16} className="text-slate-400" />
                        </div>
                        <select
                            value={i18n.language}
                            onChange={(e) => i18n.changeLanguage(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white min-w-[150px]"
                        >
                            <option value="en">English (US)</option>
                            <option value="hi">Hindi (हिन्दी)</option>
                            <option value="bn">Bengali (বাংলা)</option>
                            <option value="ar">Arabic (العربية)</option>
                        </select>
                    </div>
                </div>

                {/* Currency */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium dark:text-white">{t('settings.general.currency_label')}</span>
                            <Info size={16} className="text-slate-400" />
                        </div>
                        <select
                            value={settings.currency}
                            onChange={(e) => updateSettings({ currency: e.target.value })}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white min-w-[120px]"
                        >
                            {currencies.map((curr: any) => (
                                <option key={curr.code} value={curr.symbol}>
                                    {curr.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Decimal Places */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium dark:text-white">{t('settings.general.decimals_label')}</span>
                            <Info size={16} className="text-slate-400" />
                        </div>
                        <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg p-1">
                            <button
                                onClick={() => handleDecimalChange(false)}
                                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                                disabled={settings.decimals <= 0}
                            >
                                <Minus size={16} />
                            </button>
                            <span className="w-12 text-center font-mono font-medium dark:text-white">
                                {String(settings.decimals).padStart(2, '0')}
                            </span>
                            <button
                                onClick={() => handleDecimalChange(true)}
                                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                                disabled={settings.decimals >= 4}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sharing */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium dark:text-white">{t('settings.general.sharing_label')}</span>
                            <Info size={16} className="text-slate-400" />
                        </div>
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="toggle"
                                id="sharing-toggle"
                                checked={settings.enableSharing || false}
                                onChange={(e) => updateSettings({ enableSharing: e.target.checked })}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                style={{ right: settings.enableSharing ? '0' : '50%', borderColor: settings.enableSharing ? '#3b82f6' : '#d1d5db' }}
                            />
                            <label
                                htmlFor="sharing-toggle"
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.enableSharing ? 'bg-blue-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                    </div>
                </div>

                {/* Bill-wise Profit Report Toggle */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium dark:text-white">{t('settings.general.enable_bill_profit')}</span>
                            <Info size={16} className="text-slate-400" />
                        </div>
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="bill-profit-toggle"
                                id="bill-profit-toggle"
                                checked={settings.enableBillWiseProfit || false}
                                onChange={(e) => updateSettings({ enableBillWiseProfit: e.target.checked })}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                style={{ right: settings.enableBillWiseProfit ? '0' : '50%', borderColor: settings.enableBillWiseProfit ? '#3b82f6' : '#d1d5db' }}
                            />
                            <label
                                htmlFor="bill-profit-toggle"
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.enableBillWiseProfit ? 'bg-blue-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                    </div>
                </div>

                {/* Stock Report Toggle */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium dark:text-white">{t('settings.general.enable_stock_report')}</span>
                            <Info size={16} className="text-slate-400" />
                        </div>
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="stock-report-toggle"
                                id="stock-report-toggle"
                                checked={settings.enableStockReport || false}
                                onChange={(e) => updateSettings({ enableStockReport: e.target.checked })}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                style={{ right: settings.enableStockReport ? '0' : '50%', borderColor: settings.enableStockReport ? '#3b82f6' : '#d1d5db' }}
                            />
                            <label
                                htmlFor="stock-report-toggle"
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.enableStockReport ? 'bg-blue-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                    </div>
                </div>

                {/* Excel Export Toggle */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium dark:text-white">{t('settings.general.enable_excel_export')}</span>
                            <Info size={16} className="text-slate-400" />
                        </div>
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="excel-export-toggle"
                                id="excel-export-toggle"
                                checked={settings.enableExcelExport || false}
                                onChange={(e) => updateSettings({ enableExcelExport: e.target.checked })}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                style={{ right: settings.enableExcelExport ? '0' : '50%', borderColor: settings.enableExcelExport ? '#3b82f6' : '#d1d5db' }}
                            />
                            <label
                                htmlFor="excel-export-toggle"
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.enableExcelExport ? 'bg-blue-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                    </div>
                </div>

                {/* Global Tax Toggle */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium dark:text-white">{t('pos.add_vat', { defaultValue: 'Apply Tax (15%)' })}</span>
                                <Info size={16} className="text-slate-400" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {t('settings.general.apply_tax_desc', { defaultValue: 'Automatically add 15% VAT to all orders' })}
                            </p>
                        </div>
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="apply-tax-toggle"
                                id="apply-tax-toggle"
                                checked={settings.applyTax || false}
                                onChange={(e) => updateSettings({ applyTax: e.target.checked })}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                style={{ right: settings.applyTax ? '0' : '50%', borderColor: settings.applyTax ? '#3b82f6' : '#d1d5db' }}
                            />
                            <label
                                htmlFor="apply-tax-toggle"
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.applyTax ? 'bg-blue-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                    </div>
                </div>

                {/* Custom Invoice Prefix */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2" title="Default is INV-">
                            <span className="font-medium dark:text-white">{t('settings.general.invoice_prefix') || 'Invoice Prefix'}</span>
                            <Info size={16} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={settings.invoicePrefix || 'INV-'}
                            onChange={(e) => updateSettings({ invoicePrefix: e.target.value })}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white min-w-[120px] text-right"
                            placeholder="INV-"
                        />
                    </div>
                </div>

                {/* Spreadsheet Feature Toggle */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium dark:text-white">Enable Spreadsheet Features</span>
                            <Info size={16} className="text-slate-400" />
                        </div>
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="spreadsheet-toggle"
                                id="spreadsheet-toggle"
                                checked={settings.enableSpreadsheet || false}
                                onChange={(e) => updateSettings({ enableSpreadsheet: e.target.checked })}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                style={{ right: settings.enableSpreadsheet ? '0' : '50%', borderColor: settings.enableSpreadsheet ? '#3b82f6' : '#d1d5db' }}
                            />
                            <label
                                htmlFor="spreadsheet-toggle"
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.enableSpreadsheet ? 'bg-blue-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                    </div>
                </div>

                {/* Cafe Mode Toggle */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium dark:text-white">{t('settings.general.cafe_mode', { defaultValue: 'Enable Market / Cafe Mode' })}</span>
                                <Info size={16} className="text-slate-400" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {t('settings.general.cafe_mode_desc', { defaultValue: 'Enable image-based POS for restaurants/cafes' })}
                            </p>
                        </div>
                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="cafe-mode-toggle"
                                id="cafe-mode-toggle"
                                checked={settings.cafeMode || false}
                                onChange={(e) => updateSettings({ cafeMode: e.target.checked })}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                style={{ right: settings.cafeMode ? '0' : '50%', borderColor: settings.cafeMode ? '#3b82f6' : '#d1d5db' }}
                            />
                            <label
                                htmlFor="cafe-mode-toggle"
                                className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.cafeMode ? 'bg-blue-500' : 'bg-gray-300'}`}
                            ></label>
                        </div>
                    </div>
                </div>

                {/* Date Format */}
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <span className="font-medium dark:text-white">{t('settings.general.date_format_label')}</span>
                        <select
                            value={settings.dateFormat}
                            onChange={(e) => updateSettings({ dateFormat: e.target.value })}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white min-w-[150px]"
                        >
                            {dateFormats.map((fmt: any) => (
                                <option key={fmt.value} value={fmt.value}>
                                    {fmt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneralTab;
