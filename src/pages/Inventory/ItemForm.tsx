import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db, createRecordMetadata, updateRecordMetadata } from '../../services/db';
import type { Item, Supplier, Category } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import { Save, ArrowLeft, ScanBarcode, ShieldOff, Upload, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

const ItemForm: React.FC = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useNotification();
    const { hasPermission } = useAuth();
    const { settings } = useSettings();
    const isEdit = !!id;
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    if (!hasPermission(isEdit ? 'inventory_edit' : 'inventory_add')) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                <ShieldOff size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('common.access_denied')}</h2>
                <p className="text-slate-500">{t('inventory.access_denied_manage')}</p>
                <button
                    onClick={() => navigate('/inventory')}
                    className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm"
                >
                    {t('inventory.back_to_list')}
                </button>
            </div>
        );
    }

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
        itemCode: ''
    });

    useEffect(() => {
        const saved = localStorage.getItem('businessDetails');
        if (saved) {
            const details = JSON.parse(saved);
            if (details.taxRate && parseFloat(details.taxRate) > 0) {
                const rate = parseFloat(details.taxRate);
                // Auto-set tax rate for new items
                if (!isEdit) {
                    setFormData(prev => ({
                        ...prev,
                        taxRate: rate,
                        taxType: 'exclusive'
                    }));
                }
            }
        }

        // Fetch Suppliers and Categories
        const fetchData = async () => {
            const allSuppliers = await db.suppliers.toArray();
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
        let value: any = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        if (value === '') {
            // Nullify optional ID fields when cleared
            if (e.target.name === 'supplierId' || e.target.name === 'categoryId') {
                value = undefined;
            }
        }
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEdit) {
                const updatedItem = { ...formData, ...updateRecordMetadata() };
                await db.items.update(id!, updatedItem);
                addToast(t('inventory.update_success'), 'success');
            } else {
                const newItem = { ...formData, ...createRecordMetadata() };
                await db.items.add(newItem);
                addToast(t('inventory.save_success'), 'success');
            }
            navigate('/inventory');
        } catch (error) {
            console.error("Failed to save item:", error);
            addToast(t('inventory.save_error'), 'error');
        }
    };

    const generateBarcode = () => {
        // Simple random barcode generation
        const random = Math.floor(10000000 + Math.random() * 90000000).toString();
        setFormData({ ...formData, barcode: random });
    };

    return (
        <div className="max-w-4xl mx-auto">
            <button
                onClick={() => navigate('/inventory')}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft size={20} /> {t('inventory.back_to_inventory')}
            </button>

            <h1 className="text-2xl font-bold mb-6 dark:text-white">
                {isEdit ? t('inventory.edit_item') : t('inventory.add_item')}
            </h1>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Basic Info */}
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.item_name')}</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                    />
                </div>

                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.arabic_name') || 'Arabic Name'}</label>
                    <input
                        type="text"
                        name="arabicName"
                        value={formData.arabicName || ''}
                        onChange={handleChange}
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        dir="rtl"
                        placeholder="الاسم العربي"
                    />
                </div>

                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('purchases.supplier') || 'Supplier'}</label>
                    <select
                        name="supplierId"
                        value={formData.supplierId || ''}
                        onChange={handleChange}
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">-- {t('common.select') || 'Select Supplier'} --</option>
                        {suppliers.map((sup: any) => (
                            <option key={`sup-${sup.id}`} value={sup.id}>
                                {sup.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Cafe Mode Category Selection */}
                {settings.cafeMode && (
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t('inventory.category') || 'Category'}
                        </label>
                        <select
                            name="categoryId"
                            value={formData.categoryId || ''}
                            onChange={handleChange}
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">-- {t('common.select') || 'Select Category'} --</option>
                            {categories.map((cat: any) => (
                                <option key={`cat-${cat.id}`} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.unit')}</label>
                    <select
                        name="unit"
                        value={formData.unit || 'pc'}
                        onChange={handleChange}
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
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

                {/* Pricing */}
                <div className="col-span-2 border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-4">{t('inventory.pricing_tax')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.sale_price')}</label>
                            <input
                                type="number"
                                name="salePrice"
                                value={formData.salePrice}
                                onChange={handleChange}
                                step="0.01"
                                min="0"
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                required
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.purchase_price')}</label>
                            <input
                                type="number"
                                name="purchasePrice"
                                value={formData.purchasePrice}
                                onChange={handleChange}
                                step="0.01"
                                min="0"
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                required
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.tax_type') || 'Tax Type'}</label>
                            <select
                                name="taxType"
                                value={formData.taxType}
                                onChange={handleChange}
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            >
                                <option value="exclusive">{t('common.exclusive') || 'Exclusive'}</option>
                                <option value="inclusive">{t('common.inclusive') || 'Inclusive'}</option>
                            </select>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.tax_rate') || 'Tax Rate (%)'}</label>
                            <input
                                type="number"
                                name="taxRate"
                                value={formData.taxRate || 0}
                                onChange={handleChange}
                                step="0.1"
                                min="0"
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                required
                            />
                        </div>
                    </div>

                </div>


                {/* Stock */}
                <div className="col-span-2 border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-4">{t('inventory.stock_management')}</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.current_stock')}</label>
                            <input
                                type="number"
                                name="stock"
                                value={formData.stock}
                                onChange={handleChange}
                                min="0"
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.min_stock_alert')}</label>
                            <input
                                type="number"
                                name="minStock"
                                value={formData.minStock}
                                onChange={handleChange}
                                min="0"
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.location_shelf')}</label>
                            <input
                                type="text"
                                name="location"
                                value={formData.location || ''}
                                onChange={handleChange}
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Barcode (Moved to End) */}
                <div className="col-span-2 relative border-t border-slate-100 dark:border-slate-700 pt-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.barcode')}</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            name="barcode"
                            value={formData.barcode}
                            onChange={handleChange}
                            className="flex-1 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                        />
                        <button
                            type="button"
                            onClick={generateBarcode}
                            className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            title={t('inventory.generate_barcode')}
                        >
                            <ScanBarcode size={20} />
                        </button>
                    </div>
                </div>

                {/* Item Code (PLU) */}
                <div className="col-span-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.item_code') || 'Item Code / Scale PLU'}</label>
                    <input
                        type="text"
                        name="itemCode"
                        value={formData.itemCode || ''}
                        onChange={handleChange}
                        placeholder={t('inventory.item_code_placeholder') || 'E.g. 00010'}
                        className="w-full md:w-1/2 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">Use this for weighing scale PLU matching.</p>
                </div>

                {/* Image Upload (Cafe Mode Only) */}
                {settings.cafeMode && (
                    <div className="col-span-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('inventory.item_image') || 'Item Image'}
                        </label>
                        {formData.image ? (
                            <div className="relative inline-block">
                                <img
                                    src={formData.image}
                                    alt="Item preview"
                                    className="w-32 h-32 object-cover rounded-lg border-2 border-slate-200 dark:border-slate-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, image: undefined })}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                    title={t('inventory.remove_image') || 'Remove Image'}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (file.size > 500000) {
                                                addToast('Image size should be less than 500KB', 'error');
                                                return;
                                            }
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setFormData({ ...formData, image: reader.result as string });
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                    className="hidden"
                                    id="image-upload"
                                />
                                <label
                                    htmlFor="image-upload"
                                    className="flex items-center justify-center gap-2 w-40 h-40 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                    <Upload size={24} className="text-slate-400" />
                                    <span className="text-sm text-slate-500">{t('inventory.upload_image') || 'Upload'}</span>
                                </label>
                            </div>
                        )}
                        <p className="text-xs text-slate-500 mt-2">Max 500KB • JPG, PNG, WEBP</p>
                    </div>
                )}

                <div className="col-span-2 pt-6 mt-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/inventory')}
                        className="px-6 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
                    >
                        <Save size={20} />
                        {isEdit ? t('common.update') : t('common.save')}
                    </button>
                </div>

            </form >
        </div >
    );
};

export default ItemForm;
