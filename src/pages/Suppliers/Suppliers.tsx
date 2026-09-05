import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Phone, Building, ShieldOff, Search, Sparkles, Mail, ArrowUpRight } from 'lucide-react';
import { db, type Supplier, type SyncEntity, createRecordMetadata, updateRecordMetadata, softDeleteMetadata } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../../components/UI/Modal';
import ConfirmationModal from '../../components/UI/ConfirmationModal';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useSettings } from '../../contexts/SettingsContext';
import Pagination from '../../components/UI/Pagination';

const Suppliers: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const { formatCurrency } = useSettings();
 const [suppliers, setSuppliers] = useState<Supplier[]>([]);
 const [loading, setLoading] = useState(true);
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 
 // Pagination State
 const [currentPage, setCurrentPage] = useState(1);
 const [pageSize, setPageSize] = useState(50);
 
 const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
 const { addToast } = useNotification();
 const { hasPermission, isAdmin, activeBranchId, activeBranch } = useAuth();

 // Form State
 const [name, setName] = useState('');
 const [phone, setPhone] = useState('');
 const [email, setEmail] = useState('');
 const [location, setLocation] = useState('');
 const [taxNumber, setTaxNumber] = useState('');

 const fetchSuppliers = async () => {
 try {
 const baseQuery = activeBranch?.isMaster ? db.suppliers : db.suppliers.where('branchId').equals(activeBranchId);
 const data = await (baseQuery as any)
 .filter((s: any) => !s.deletedAt)
 .toArray();
 setSuppliers(data);
 } catch (error) {
 console.error(error);
 addToast(t('suppliers.load_error'), 'error');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchSuppliers();
 }, [activeBranchId, activeBranch?.isMaster]);

 // Reset to page 1 when search changes
 useEffect(() => {
 setCurrentPage(1);
 }, [searchQuery]);

 const resetForm = () => {
 setName('');
 setPhone('');
 setEmail('');
 setLocation('');
 setTaxNumber('');
 setEditingSupplier(null);
 };

 const handleEdit = (supplier: Supplier) => {
 setEditingSupplier(supplier);
 setName(supplier.name);
 setPhone(supplier.phone);
 setEmail(supplier.email || '');
 setLocation(supplier.location || '');
 setTaxNumber(supplier.taxNumber || '');
 setIsModalOpen(true);
 };

 const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);

 const handleDeleteClick = (id: string) => {
 setSupplierToDelete(id);
 };

 const handleConfirmDelete = async () => {
 if (supplierToDelete) {
 try {
 await db.suppliers.update(supplierToDelete, softDeleteMetadata());
 addToast(t('suppliers.delete_success'), 'success');
 fetchSuppliers();
 } catch {
 addToast(t('suppliers.delete_error'), 'error');
 } finally {
 setSupplierToDelete(null);
 }
 }
 };

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!name || !phone) {
 addToast(t('suppliers.validation_error'), 'error');
 return;
 }

 const supplierData: Omit<Supplier, keyof SyncEntity> = {
 name,
 phone,
 email,
 location,
 taxNumber,
 balance: editingSupplier ? editingSupplier.balance : 0
 };

 try {
 if (editingSupplier && editingSupplier.id) {
 await db.suppliers.update(editingSupplier.id, { ...supplierData, ...updateRecordMetadata() });
 addToast(t('suppliers.update_success'), 'success');
 } else {
 await db.suppliers.add({ ...supplierData, ...createRecordMetadata() });
 addToast(t('suppliers.add_success'), 'success');
 }
 setIsModalOpen(false);
 resetForm();
 fetchSuppliers();
 } catch (error) {
 addToast(t('suppliers.save_error'), 'error');
 }
 };

 if (!hasPermission('suppliers_view')) {
 return (
 <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center p-8 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
 <ShieldOff size={48} className="text-slate-300 mb-4"/>
 <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">{t('suppliers.access_denied')}</h2>
 <p className="text-slate-700">{t('suppliers.access_denied_msg')}</p>
 </div>
);
 }

 if (loading) return (
 <div className="flex items-center justify-center h-96">
 <div className="w-12 h-12 border-4 border-slate-900 dark:border-white border-t-transparent rounded-full"></div>
 </div>
);

 const filteredSuppliers = suppliers.filter((supplier: any) =>
 !supplier.deletedAt && (
 (supplier.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
 (supplier.phone || '').includes(searchQuery) ||
 (supplier.taxNumber && supplier.taxNumber.toLowerCase().includes(searchQuery.toLowerCase()))
)
);

 const totalSuppliers = filteredSuppliers.length;
 const totalPages = Math.ceil(totalSuppliers / pageSize);
 const offset = (currentPage - 1) * pageSize;
 const paginatedSuppliers = filteredSuppliers.slice(offset, offset + pageSize);

 return (
 <div className="space-y-6 md:space-y-8 pb-20 md:pb-6">
 {/* Header Bar */}
 <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/50 dark:border-slate-700/30 relative overflow-hidden group">
 
 
 <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 md:gap-8 relative z-10">
 <div>
 <h1 className="text-2xl md:text-4xl font-semibold dark:text-white flex items-center gap-3 md:gap-4 tracking-tight uppercase">
 <div className="p-3 md:p-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl md:rounded-2xl">
 <Building size={24} className="md:w-8 md:h-8" strokeWidth={2.5} />
 </div>
 <span>{t('suppliers.title')}</span>
 </h1>
 <p className="text-slate-700 dark:text-slate-300 font-bold mt-2 ml-1 md:ml-2 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-2">
 <Sparkles size={14} className="text-amber-500"/>
 {t('suppliers.manage_vendors')}
 </p>
 </div>

 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full md:w-auto">
 <div className="relative w-full sm:w-80 group">
 <Search className="w-5 h-5 absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white"/>
 <input
 type="text"
 placeholder={t('common.search') || 'Search suppliers...'}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-12 md:pl-14 pr-4 md:pr-6 py-3 md:py-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-lg md:rounded-xl font-bold text-sm focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20 outline-none dark:text-white"
 />
 </div>
 {hasPermission('suppliers_add') && (
 <button type="button"
 
 
 onClick={() => { resetForm(); setIsModalOpen(true); }}
 className="flex items-center justify-center gap-2 md:gap-3 bg-slate-800 dark:bg-slate-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg md:rounded-xl font-semibold text-xs uppercase tracking-wider hover:bg-black group shrink-0 w-full sm:w-auto"
 >
 <Plus className="w-5 h-5"/>
 <span>{t('common.add')}</span>
 </button>
)}
 </div>
 </div>
 </div>

  {/* Modern List Layout */}
  <div className="bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-sm">
    {paginatedSuppliers.length > 0 ? (
      <>
        {/* Mobile card view */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {paginatedSuppliers.map((supplier: any) => (
            <div
              key={supplier.id}
              onClick={() => navigate(`/suppliers/${supplier.id}`)}
              className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-sm uppercase flex items-center justify-center shrink-0">
                    {supplier.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">{supplier.name}</div>
                    <div className="flex items-center gap-1 mt-0.5 text-slate-500 dark:text-slate-400 text-xs">
                      <Phone size={11} />
                      <span className="font-mono">{supplier.phone}</span>
                    </div>
                  </div>
                </div>
                <span className={clsx(
                  "text-sm font-black tracking-tight px-3 py-1 rounded-lg border",
                  supplier.balance > 0
                    ? "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
                    : "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                )}>
                  {formatCurrency(supplier.balance)}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 ml-13 pl-0">
                {supplier.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={11} className="text-slate-400 shrink-0"/>
                    <span>{supplier.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Tax:</span>
                  <span className="font-mono">{supplier.taxNumber || 'N/A'}</span>
                  {supplier.location && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="truncate">{supplier.location}</span>
                    </>
                  )}
                </div>
              </div>
              <div
                className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800"
                onClick={e => e.stopPropagation()}
              >
                {hasPermission('suppliers_edit') && (
                  <button
                    type="button"
                    onClick={() => handleEdit(supplier)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Edit size={14} /> {t('common.edit') || 'Edit'}
                  </button>
                )}
                {(isAdmin || hasPermission('suppliers_delete')) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(supplier.id!)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} /> {t('common.delete') || 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left whitespace-nowrap min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">{t('suppliers.name') || 'Supplier'}</th>
                <th className="px-6 py-4">{t('suppliers.contact') || 'Contact Info'}</th>
                <th className="px-6 py-4">{t('suppliers.tax_vat') || 'Tax & Location'}</th>
                <th className="px-6 py-4 text-right">{t('purchases.balance_due') || 'Balance Due'}</th>
                <th className="px-6 py-4 text-right">{t('common.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedSuppliers.map((supplier: any) => (
                <tr
                  key={supplier.id}
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-sm uppercase flex items-center justify-center shrink-0">
                        {supplier.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-white text-sm hover:underline">{supplier.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {supplier.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Phone size={12} className="text-slate-400" />
                        <span className="font-semibold font-mono">{supplier.phone}</span>
                      </div>
                      {supplier.email && (
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <Mail size={12} className="text-slate-400" />
                          <span>{supplier.email}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1">
                      <div className="text-slate-700 dark:text-slate-300">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Tax:</span>
                        <span className="font-semibold font-mono">{supplier.taxNumber || 'N/A'}</span>
                      </div>
                      {supplier.location && (
                        <div className="text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={supplier.location}>
                          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Loc:</span>
                          <span>{supplier.location}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={clsx(
                      "text-lg font-black tracking-tight px-4 py-2 rounded-xl border inline-block",
                      supplier.balance > 0
                        ? "bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 shadow-sm"
                        : "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 shadow-sm"
                    )}>
                      {formatCurrency(supplier.balance)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {hasPermission('suppliers_edit') && (
                        <button
                          type="button"
                          onClick={() => handleEdit(supplier)}
                          className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {(isAdmin || hasPermission('suppliers_delete')) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(supplier.id!)}
                          className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ) : (
      <div className="py-32 text-center">
        <Building size={80} strokeWidth={1} className="mx-auto mb-6 text-slate-300"/>
        <p className="text-xl font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-tight">{t('suppliers.no_suppliers')}</p>
        <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mt-2">{t('suppliers.start_msg')}</p>
        <button type="button"
          onClick={() => setIsModalOpen(true)}
          className="mt-8 px-8 py-3 bg-slate-900 dark:bg-white text-white rounded-2xl font-semibold text-xs uppercase tracking-wider"
        >
          {t('common.add_your_first')}
        </button>
      </div>
    )}
  </div>

 <div className="mt-8">
 <Pagination 
 currentPage={currentPage}
 totalPages={totalPages}
 onPageChange={setCurrentPage}
 totalItems={totalSuppliers}
 itemsPerPage={pageSize}
 onItemsPerPageChange={setPageSize}
 />
 </div>

 <Modal
 isOpen={isModalOpen}
 onClose={() => setIsModalOpen(false)}
 title={editingSupplier ? t('suppliers.edit_supplier', 'Edit Supplier') : t('suppliers.add_supplier', 'Add Supplier')}
 >
 <form onSubmit={handleSave} className="p-8 space-y-6">
 <div className="space-y-2">
 <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider ml-1">{t('suppliers.name')}</label>
 <input
 type="text"
 required
 placeholder="Supplier Name"
 className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 value={name}
 onChange={e => setName(e.target.value)}
 />
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider ml-1">{t('suppliers.phone')}</label>
 <input
 type="tel"
 required
 placeholder="+966"
 className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 value={phone}
 onChange={e => setPhone(e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider ml-1">{t('suppliers.tax_vat')}</label>
 <input
 type="text"
 placeholder="VAT Number"
 className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 value={taxNumber}
 onChange={e => setTaxNumber(e.target.value)}
 />
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider ml-1">{t('suppliers.email')}</label>
 <input
 type="email"
 placeholder="email@example.com"
 className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 value={email}
 onChange={e => setEmail(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider ml-1">{t('suppliers.location')}</label>
 <textarea
 placeholder="Full Address"
 className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
 rows={3}
 value={location}
 onChange={e => setLocation(e.target.value)}
 />
 </div>

 <div className="flex justify-end gap-4 pt-6">
 <button
 type="button"
 onClick={() => setIsModalOpen(false)}
 className="px-8 py-4 text-slate-600 hover:text-slate-900 dark:hover:text-white font-semibold text-xs uppercase tracking-wider"
 >
 {t('common.cancel')}
 </button>
 <button
 
 
 type="submit"
 className="px-10 py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-semibold text-xs uppercase tracking-wider"
 >
 {editingSupplier ? t('common.update') : t('common.save')}
 </button>
 </div>
 </form>
 </Modal>

 <ConfirmationModal
 isOpen={!!supplierToDelete}
 onClose={() => setSupplierToDelete(null)}
 onConfirm={handleConfirmDelete}
 title={t('suppliers.delete_title')}
 message={t('suppliers.delete_confirm')}
 confirmText={t('common.delete')}
 variant="danger"
 />
 </div>
);
};

export default Suppliers;
