import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UtensilsCrossed, Users, Plus, CheckCircle2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import { useSettings, type RestaurantTable } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

interface TableSelectionScreenProps {
  onSelectTable: (table: RestaurantTable | null) => void;
}

const TableSelectionScreen: React.FC<TableSelectionScreenProps> = ({ onSelectTable }) => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { activeBranchId } = useAuth();

  const tables = settings.tables || [];

  // Load all active held bills (active table orders)
  const heldBills = useLiveQuery(async () => {
    if (!activeBranchId) return [];
    return await db.heldBills
      .where('branchId').equals(activeBranchId)
      .toArray();
  }, [activeBranchId]) || [];

  // Build a map: tableName → heldBill info
  const occupancyMap = useMemo(() => {
    const map = new Map<string, { itemCount: number; createdAt: Date }>();
    for (const bill of heldBills) {
      if (bill.tableName) {
        map.set(bill.tableName, {
          itemCount: bill.cartItems?.length ?? 0,
          createdAt: bill.createdAt,
        });
      }
    }
    return map;
  }, [heldBills]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-4 pb-4 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft size={18} className="text-slate-700 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Select Table</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {heldBills.filter(b => b.tableName).length} of {tables.length} tables occupied
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-full">
            <UtensilsCrossed size={12} className="text-orange-500" />
            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Waiter Mode</span>
          </div>
        </div>
      </div>

      {/* Table grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
              <UtensilsCrossed size={24} className="text-slate-400" />
            </div>
            <p className="font-bold text-slate-700 dark:text-slate-300 text-base">No tables configured</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Add tables in Settings → General → Order Taking Mode
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tables.map(table => {
              const occupancy = occupancyMap.get(table.name);
              const isOccupied = !!occupancy;

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => onSelectTable(table)}
                  className={clsx(
                    'relative flex flex-col items-center justify-center rounded-2xl border-2 p-4 min-h-[110px] active:scale-[0.97] transition-all text-center gap-2',
                    isOccupied
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                  )}
                >
                  {/* Occupied badge */}
                  {isOccupied && (
                    <div className="absolute top-2 right-2">
                      <span className="w-5 h-5 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {occupancy.itemCount}
                      </span>
                    </div>
                  )}

                  <div className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    isOccupied ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-slate-100 dark:bg-slate-800'
                  )}>
                    <UtensilsCrossed size={18} className={isOccupied ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'} />
                  </div>

                  <div>
                    <p className={clsx(
                      'font-bold text-sm leading-tight',
                      isOccupied ? 'text-amber-800 dark:text-amber-300' : 'text-slate-900 dark:text-white'
                    )}>
                      {table.name}
                    </p>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Users size={10} className="text-slate-400" />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {table.capacity} seats
                      </span>
                    </div>
                  </div>

                  {isOccupied && (
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      {occupancy.itemCount} item{occupancy.itemCount !== 1 ? 's' : ''}
                    </span>
                  )}

                  {!isOccupied && (
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Free
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Skip table — go directly to POS */}
        <button
          type="button"
          onClick={() => onSelectTable(null)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold text-sm active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
        >
          <Plus size={16} />
          No Table — Direct Order
        </button>
      </div>
    </div>
  );
};

export default TableSelectionScreen;
