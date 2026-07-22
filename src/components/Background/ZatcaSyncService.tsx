import React, { useEffect, useRef } from 'react';
import { db, getCurrentBranchId } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';

export const ZatcaSyncService: React.FC = () => {
 const { addToast } = useNotification();
 const isSyncing = useRef(false);

 useEffect(() => {
 const syncPendingInvoices = async () => {
 if (isSyncing.current) return;
 isSyncing.current = true;

 try {
 // Fetch ZATCA config
 const zatcaConfig = (window.electron && window.electron.zatca)
 ? await window.electron.zatca.getConfig()
 : JSON.parse(localStorage.getItem('zatca_config') || 'null');

 if (!zatcaConfig || (zatcaConfig.status !== 'LIVE' && zatcaConfig.status !== 'COMPLIANCE_OBTAINED')) {
 isSyncing.current = false;
 return; // ZATCA not configured or active
 }

 const isLive = zatcaConfig.status === 'LIVE';
 const activeCsid = isLive ? zatcaConfig.productionCsid : zatcaConfig.complianceCsid;
 const activeSecret = isLive ? zatcaConfig.productionSecret : zatcaConfig.complianceSecret;
 const env = zatcaConfig.environment || 'PRODUCTION';

 if (!activeCsid || !activeSecret) {
 isSyncing.current = false;
 return;
 }

 // Get all pending or errored invoices that have XML stored locally
 const pendingInvoices = await db.invoices
 .filter(inv => (inv.zatcaStatus === 'PENDING' || inv.zatcaStatus === 'ERROR') && !!inv.zatcaXml)
 .toArray();

 if (pendingInvoices.length === 0) {
 isSyncing.current = false;
 return;
 }

 // Dynamically import reporting module to save memory on load
 const { reportInvoice } = await import('../../services/zatcaApi');

 let successCount = 0;

 for (const invoice of pendingInvoices) {
 try {
 const { zatcaXml, zatcaHash, id } = invoice;
 // Use a dummy UUID if one wasn't stored (UUID is for API request tracing, not hashing)
 const requestUuid = invoice.id || crypto.randomUUID();

 const reportResult = await reportInvoice(
 zatcaXml!,
 zatcaHash!,
 requestUuid,
 activeCsid,
 activeSecret,
 env
);

 if (reportResult.status === 'REPORTED') {
 await db.invoices.update(id, { zatcaStatus: 'REPORTED' });
 successCount++;

 // Update branch hash chain (ensure it moves forward if this is the latest)
 const branchId = invoice.branchId || getCurrentBranchId();
 const branch = await db.branches.get(branchId);
 if (branch) {
 await db.branches.update(branchId, {
 lastInvoiceHash: zatcaHash
 });
 }
 } else {
 await db.invoices.update(id, { 
 zatcaStatus: 'ERROR', 
 zatcaError: JSON.stringify(reportResult) 
 });
 // If one fails with validation, we continue to others, but typically sequence matters
 }
 } catch (err) {
 console.error(`Failed to sync invoice ${invoice.id}:`, err);
 }
 }

 if (successCount > 0) {
 addToast(`Successfully synced ${successCount} offline ZATCA invoices.`, 'success');
 }

 } catch (err) {
 console.error("ZatcaSyncService error:", err);
 } finally {
 isSyncing.current = false;
 }
 };

 // Run immediately if online
 if (navigator.onLine) {
 syncPendingInvoices();
 }

 // Run when coming back online
 window.addEventListener('online', syncPendingInvoices);
 
 // Polling interval (Every 3 minutes)
 const interval = setInterval(syncPendingInvoices, 3 * 60 * 1000);

 return () => {
 window.removeEventListener('online', syncPendingInvoices);
 clearInterval(interval);
 };
 }, [addToast]);

 return null; // Headless component
};

export default ZatcaSyncService;
