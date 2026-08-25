import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db, createRecordMetadata, updateRecordMetadata } from '../../services/db';
import type { Item, Supplier, Category } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import { 
  Save, ArrowLeft, ScanBarcode, ShieldOff, 
  Upload, X, Box, Tag, Banknote, 
  Warehouse, Hash, Info, Sparkles, Package, Wand2, Printer
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import BarcodeModal from './BarcodeModal';
import clsx from 'clsx';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

interface ItemFormProps {
  isInline?: boolean;
  onSuccess?: (item: any) => void;
  onCancel?: () => void;
}

const ItemForm: React.FC<ItemFormProps> = ({ isInline, onSuccess, onCancel }) => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { hasPermission } = useAuth();
  const { settings } = useSettings();
  const isEdit = !isInline && !!id;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Barcode Printing State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeModalItem, setBarcodeModalItem] = useState<Item[] | null>(null);

  const [formData, setFormData] = useState<Item>({
    id: '',
    branchId: '',
    updatedAt: new Date(),
    name: '',
    arabicName: '',
    barcode: '',
    salePrice: 0,
    purchasePrice: 0,
    taxType: 'exclusive',
    taxRate: 0,
    stock: 0,
    minStock: 5,
    location: '',
    unit: 'pc',
    itemCode: '',
    trackSerial: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('businessDetails');
    if (saved) {
      const details = JSON.parse(saved);
      if (details.taxRate && parseFloat(details.taxRate) > 0) {
        const rate = parseFloat(details.taxRate);
        if (!isEdit) {
          setFormData(prev => ({
            ...prev,
            taxRate: rate,
            taxType: 'exclusive'
          }));
        }
      }
    }

    const fetchData = async () => {
      const allSuppliers = await db.suppliers.filter((s: any) => !s.deletedAt).toArray();
      setSuppliers(allSuppliers);

      const allCategories = await db.categories.toArray();
      setCategories(allCategories);
    };
    fetchData();
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) {
      db.items.get(id!).then((item) => {
        if (item) setFormData(item);
      });
    }
  }, [id, isEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const rawVal = e.target.value;
    let value: any = e.target.type === 'number'
      ? (rawVal === '' ? '' : (isNaN(parseFloat(rawVal)) ? 0 : parseFloat(rawVal)))
      : rawVal;
    if (value === '') {
      if (e.target.name === 'supplierId' || e.target.name === 'categoryId') {
        value = undefined;
      }
    }
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Clean numeric fields before saving
      const cleanedData = {
        ...formData,
        salePrice: Number(formData.salePrice) || 0,
        purchasePrice: Number(formData.purchasePrice) || 0,
        stock: Number(formData.stock) || 0,
        minStock: Number(formData.minStock) || 0,
        taxRate: Number(formData.taxRate) || 0
      };
      if (isEdit) {
        const updatedItem = { ...cleanedData, ...updateRecordMetadata() };
        await db.items.update(id!, updatedItem);
        addToast(t('inventory.update_success'), 'success');
        if (isInline && onSuccess) {
          onSuccess(updatedItem);
        } else {
          navigate('/inventory');
        }
      } else {
        const newItem = { ...cleanedData, ...createRecordMetadata() };
        const newId = await db.items.add(newItem);
        (newItem as any).id = newId as string;
        addToast(t('inventory.save_success'), 'success');
        if (isInline && onSuccess) {
          onSuccess(newItem);
        } else {
          navigate('/inventory');
        }
      }
    } catch (error) {
      console.error("Failed to save item:", error);
      addToast(t('inventory.save_error'), 'error');
    }
  };

  const generateBarcode = async (): Promise<string> => {
    let isUnique = false;
    let randomCode = '';
    let attempts = 0;
    while (!isUnique && attempts < 20) {
      attempts++;
      randomCode = Math.floor(10000000 + Math.random() * 90000000).toString();
      const existing = await db.items.where('barcode').equals(randomCode).first();
      if (!existing || (isEdit && existing.id === id)) {
        isUnique = true;
      }
    }
    setFormData(prev => ({ ...prev, barcode: randomCode }));
    addToast(t('inventory.barcodes_generated', { count: 1 }) || 'Barcode generated successfully', 'info');
    return randomCode;
  };

  const handlePrintBarcode = async () => {
    let code = formData.barcode;
    if (!code || code.trim() === '') {
      code = await generateBarcode();
    }
    const currentItem: Item = {
      ...formData,
      barcode: code,
      name: formData.name || 'Sample Item',
      salePrice: Number(formData.salePrice) || 0,
      purchasePrice: Number(formData.purchasePrice) || 0,
      stock: Number(formData.stock) || 0,
      id: formData.id || (isEdit && id ? id : 'TEMP_ID')
    };
    setBarcodeModalItem([currentItem]);
    setIsBarcodeModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 700 * 1024) {
      addToast(t('inventory.image_size_error') || 'Image size must be less than 700KB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      addToast(t('common.error') || 'Failed to read file', 'error');
    };
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData(prev => ({ ...prev, image: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: undefined }));
  };

  if (!hasPermission(isEdit ? 'inventory_edit' : 'inventory_add')) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-8">
        <ShieldOff size={48} className="text-slate-300 mb-4"/>
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
        <button type="button" onClick={() => isInline && onCancel ? onCancel() : navigate('/inventory')} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl uppercase text-[10px] font-semibold tracking-wider">{t('inventory.back_to_list')}</button>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto p-4 md:p-8 space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <button type="button"
          onClick={() => isInline && onCancel ? onCancel() : navigate('/inventory')}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-800 dark:hover:text-white font-semibold text-[10px] uppercase tracking-wider group"
        >
          <ArrowLeft size={18} className="group-" /> {t('inventory.back_to_inventory')}
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrintBarcode}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-full border border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-semibold uppercase tracking-wider transition-colors"
            title={t('inventory.print_label') || 'Print Barcode Label'}
          >
            <Printer size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span>{t('inventory.print_label') || 'Print Label'}</span>
          </button>
          <div className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-full border border-slate-900/20 dark:border-white/20">
            <Sparkles size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Premium Catalog</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
        <div>
          <h1 className="text-4xl font-semibold dark:text-white tracking-tight uppercase flex items-center gap-4">
            <Package size={40} className="text-slate-900 dark:text-white"/>
            {isEdit ? t('inventory.edit_item') : t('inventory.add_item')}
          </h1>
          <p className="text-slate-700 dark:text-slate-300 font-bold mt-2 text-[10px] uppercase tracking-wider">
            {isEdit ? 'Update product specifications and pricing' : 'Initialize a new product in your system'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Primary Details */}
        <div className="xl:col-span-2 space-y-8">
          {/* General Info Card */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-indigo-500 text-indigo-600 rounded-xl">
                <Info size={18} />
              </div>
              <h2 className="text-sm font-semibold dark:text-white uppercase tracking-wider">{t('inventory.general_info') || 'Product Details'}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.item_name')}</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter product name..."
                  className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.arabic_name')}</label>
                <input
                  type="text"
                  name="arabicName"
                  value={formData.arabicName || ''}
                  onChange={handleChange}
                  dir="rtl"
                  placeholder="الاسم العربي"
                  className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-lg outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.unit')}</label>
                <select
                  name="unit"
                  value={formData.unit || 'pc'}
                  onChange={handleChange}
                  className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white cursor-pointer"
                >
                  <option value="pc">{t('units.pc')}</option>
                  <option value="kg">{t('units.kg')}</option>
                  <option value="g">{t('units.g')}</option>
                  <option value="ltr">{t('units.ltr')}</option>
                  <option value="ml">{t('units.ml')}</option>
                  <option value="box">{t('units.box')}</option>
                  <option value="pack">{t('units.pack')}</option>
                  <option value="set">{t('units.set')}</option>
                  <option value="meter">{t('units.meter')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pricing & Tax Card */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <Banknote size={18} />
              </div>
              <h2 className="text-sm font-semibold dark:text-white uppercase tracking-wider">{t('inventory.pricing_tax')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="bg-slate-900 dark:bg-white p-6 rounded-3xl border border-slate-900/10 dark:border-white/10">
                <label className="block text-[10px] font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3 px-1">{t('inventory.sale_price')}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-700 dark:text-slate-300">$</span>
                  <input
                    type="number"
                    name="salePrice"
                    value={formData.salePrice}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full pl-10 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-semibold text-2xl tracking-tight outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10">
                <label className="block text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-3 px-1">{t('inventory.purchase_price')}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-emerald-400">$</span>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full pl-10 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-semibold text-2xl tracking-tight outline-none focus:ring-4 focus:ring-emerald-500/10 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.tax_type')}</label>
                <select
                  name="taxType"
                  value={formData.taxType}
                  onChange={handleChange}
                  className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white cursor-pointer"
                >
                  <option value="exclusive">{t('common.exclusive')}</option>
                  <option value="inclusive">{t('common.inclusive')}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.tax_rate')} (%)</label>
                <input
                  type="number"
                  name="taxRate"
                  value={formData.taxRate || 0}
                  onChange={handleChange}
                  step="0.1"
                  className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Identification & Stock */}
        <div className="space-y-8">
          {/* Product Image Card */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-slate-900 dark:bg-white text-white rounded-xl">
                <Upload size={18} />
              </div>
              <h2 className="text-sm font-semibold dark:text-white uppercase tracking-wider">{t('inventory.product_image') || 'Product Image'}</h2>
            </div>

            <div className="space-y-4">
              {formData.image ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 aspect-[16/10]">
                  <img src={formData.image} className="w-full h-full object-cover" alt="Preview"/>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-3 right-3 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 cursor-pointer hover:border-slate-900 dark:hover:border-white bg-slate-50 dark:bg-slate-900 group">
                  <Upload size={32} className="text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white group- mb-3"/>
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-center">
                    Drag & drop or click to upload
                  </span>
                  <span className="text-[9px] text-slate-600 dark:text-slate-400 mt-1 uppercase">
                    Max size: 700KB (PNG, JPG)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Identification Card */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
                <ScanBarcode size={18} />
              </div>
              <h2 className="text-sm font-semibold dark:text-white uppercase tracking-wider">{t('inventory.identification') || 'Identification'}</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.barcode')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleChange}
                    placeholder="Scan or enter barcode"
                    className="flex-1 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-xs tracking-wider outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
                  />
                  {Capacitor.isNativePlatform() && settings?.scannerType !== 'hardware' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await BarcodeScanner.requestPermissions();
                          const result = await BarcodeScanner.scan();
                          if (result.barcodes.length > 0) {
                            const rawVal = result.barcodes[0].rawValue;
                            if (rawVal) {
                              setFormData(prev => ({ ...prev, barcode: rawVal }));
                            }
                          }
                        } catch (err) {
                          addToast('Camera scan failed or denied', 'error');
                        }
                      }}
                      title="Scan via Camera"
                      className="p-4 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-2xl transition-colors flex items-center justify-center"
                    >
                      <ScanBarcode size={18} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={generateBarcode}
                    title={t('inventory.generate_barcode') || 'Generate Barcode'}
                    className="p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl transition-colors flex items-center justify-center"
                  >
                    <Wand2 size={20} />
                  </button>
                </div>
              </div>

              {settings.enableSerialTracking && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <input
                    type="checkbox"
                    id="trackSerial"
                    name="trackSerial"
                    checked={formData.trackSerial || false}
                    onChange={(e) => setFormData({ ...formData, trackSerial: e.target.checked })}
                    className="w-5 h-5 rounded-md border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <label htmlFor="trackSerial" className="text-sm font-bold text-slate-800 dark:text-white block cursor-pointer">
                      {t('inventory.track_serial', 'Track Serial Number / IMEI')}
                    </label>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                      {t('inventory.track_serial_desc', 'Force cashiers to scan unique serial numbers for each unit sold.')}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.item_code')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="itemCode"
                    value={formData.itemCode || ''}
                    onChange={handleChange}
                    placeholder="Scale PLU or Internal Code"
                    className="flex-1 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-xs tracking-wider outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handlePrintBarcode}
                    title={t('inventory.print_label') || 'Print Barcode Label'}
                    className="px-4 py-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl transition-all flex items-center gap-2 font-semibold text-xs uppercase tracking-wider shadow-sm"
                  >
                    <Printer size={18} />
                    <span className="hidden sm:inline">{t('common.print') || 'Print'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.item_code')}</label>
                <input
                  type="text"
                  name="itemCode"
                  value={formData.itemCode || ''}
                  onChange={handleChange}
                  placeholder="Scale PLU or Internal Code"
                  className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-xs tracking-wider outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Stock & Location Card */}
          <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-rose-500/10 text-rose-600 rounded-xl">
                <Warehouse size={18} />
              </div>
              <h2 className="text-sm font-semibold dark:text-white uppercase tracking-wider">{t('inventory.stock_management')}</h2>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.current_stock')}</label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.min_stock_alert')}</label>
                  <input
                    type="number"
                    name="minStock"
                    value={formData.minStock}
                    onChange={handleChange}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-sm outline-none focus:ring-4 focus:ring-rose-500/10 dark:text-white text-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.location_shelf')}</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location || ''}
                  onChange={handleChange}
                  className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-sm outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white"
                />
              </div>

              {/* Organization */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-6">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('purchases.supplier')}</label>
                  <select
                    name="supplierId"
                    value={formData.supplierId || ''}
                    onChange={handleChange}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-xs outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white cursor-pointer"
                  >
                    <option value="">-- {t('common.select')} --</option>
                    {suppliers.map((sup: any) => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">{t('inventory.category')}</label>
                  <select
                    name="categoryId"
                    value={formData.categoryId || ''}
                    onChange={handleChange}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-xs outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 dark:text-white cursor-pointer"
                  >
                    <option value="">-- {t('common.select')} --</option>
                    {categories.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="xl:col-span-3 flex flex-col md:flex-row justify-end gap-4 pt-8">
          <button
            type="button"
            onClick={handlePrintBarcode}
            className="px-8 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[10px] uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors"
          >
            <Printer size={16} />
            {t('inventory.print_label') || 'Print Label'}
          </button>
          <button
            type="button"
            onClick={() => isInline && onCancel ? onCancel() : navigate('/inventory')}
            className="px-12 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[10px] uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="px-20 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold text-[10px] uppercase tracking-wider flex items-center justify-center gap-3 transition-colors"
          >
            <Save size={18} />
            {isEdit ? t('common.update') : t('common.save')}
          </button>
        </div>
      </form>

      {/* Barcode Printing Modal */}
      <BarcodeModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        items={barcodeModalItem}
      />
    </div>
  );
};

export default ItemForm;
