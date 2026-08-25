import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
 ShieldCheck, Loader2, CheckCircle, XCircle, AlertTriangle,
 ChevronRight, RefreshCw, Upload, Lock
} from 'lucide-react';
import {
 generateCSR, requestComplianceCSID, runComplianceChecks,
 getProductionCSID, type ZatcaConfig,
} from '../../../services/zatcaApi';
import { generateComplianceSampleInvoice, localValidateSample } from '../../../services/zatcaComplianceSamples';
import { useNotification } from '../../../contexts/NotificationContext';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Phase = 'OFF' | 'READY_FOR_OTP' | 'ACTIVATING' | 'LIVE' | 'ERROR';

interface StatusLog {
 msg: string;
 ok: boolean;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const loadConfig = async (): Promise<ZatcaConfig | null> => {
 if (window.electron?.zatca) {
 const c = await window.electron.zatca.getConfig();
 if (c) return c;
 }
 const s = localStorage.getItem('zatca_config');
 return s ? JSON.parse(s) : null;
};

const persistConfig = async (cfg: ZatcaConfig) => {
 if (window.electron?.zatca) {
 await window.electron.zatca.saveConfig(cfg);
 } else {
 localStorage.setItem('zatca_config', JSON.stringify(cfg));
 }
};

const EMPTY_CONFIG: ZatcaConfig = {
  csr: '',
  privateKey: '',
  status: 'NOT_ONBOARDED',
  environment: 'PRODUCTION',
};

const ZATCA_GENESIS_HASH = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';

/* ═══════════════════════════════════════════════════════════════════════════
 Main Component
═══════════════════════════════════════════════════════════════════════════ */
const ZatcaTab: React.FC = () => {
 const { t } = useTranslation();
 const { addToast } = useNotification();

 const [config, setConfig] = useState<ZatcaConfig>(EMPTY_CONFIG);
 const [phase, setPhase] = useState<Phase>('OFF');
 const [otp, setOtp] = useState('');
 const [busy, setBusy] = useState(false);
 const [logs, setLogs] = useState<StatusLog[]>([]);
 const [error, setError] = useState('');

 // Restore panel
 const [showRestore, setShowRestore] = useState(false);
 const [restoreKey, setRestoreKey] = useState('');
 const [restoreCsid, setRestoreCsid] = useState('');
 const [restoreSecret, setRestoreSecret] = useState('');
 const [restoreRequestId, setRestoreRequestId] = useState('');
 const fileRef = useRef<HTMLInputElement>(null);

 const log = (msg: string, ok = true) =>
 setLogs((p) => [...p, { msg, ok }]);

 /* ── Boot ────────────────────────────────────────────────────────────── */
 useEffect(() => {
 loadConfig().then((cfg) => {
 if (!cfg) return;
 setConfig(cfg);
 if (cfg.status === 'LIVE') setPhase('LIVE');
 else if (cfg.status === 'COMPLIANCE_OBTAINED') setPhase('READY_FOR_OTP');
 else if (cfg.status === 'CSR_GENERATED') setPhase('READY_FOR_OTP');
 else if (cfg.status !== 'NOT_ONBOARDED') setPhase('READY_FOR_OTP');
 });
 }, []);

 /* ── Toggle ON ───────────────────────────────────────────────────────── */
 const handleEnable = async () => {
 setError('');
 setBusy(true);
 setLogs([]);
 try {
 const saved = localStorage.getItem('businessDetails');
 const biz = saved ? JSON.parse(saved) : {};

 if (!biz.gstin) {
 setError(t('zatca.vat_missing', 'Please add your VAT number in Business Details first.'));
 setBusy(false);
 return;
 }

 log('🔐 Generating cryptographic identity...');
 const keys = await generateCSR({
 commonName: biz.name || 'POS-Device',
 organizationName: biz.name || 'My Business',
 organizationUnitName: biz.address || 'Branch',
 countryName: 'SA',
 serialNumber:`1-${biz.gstin}|2-${crypto.randomUUID()}|3-1000`,
 registeredAddress: biz.address || 'Riyadh, Saudi Arabia',
 businessCategory: 'Retail',
 vatNumber: biz.gstin,
 environment: 'PRODUCTION',
 });
 log('✅ Device identity created');

 const newCfg: ZatcaConfig = {
 ...EMPTY_CONFIG,
 csr: keys.csr,
 privateKey: keys.privateKey,
 status: 'CSR_GENERATED',
 environment: 'PRODUCTION',
 };
 await persistConfig(newCfg);
 setConfig(newCfg);

 // M8 Fix: Private key is stored securely in config/electron, no unencrypted auto-download

 setPhase('READY_FOR_OTP');
 addToast('✅ Ready — enter your OTP to activate ZATCA.', 'success');
 } catch (err) {
 const msg = err instanceof Error ? err.message : 'Setup failed';
 setError(msg);
 log(`❌ ${msg}`, false);
 setPhase('ERROR');
 } finally {
 setBusy(false);
 }
 };

 /* ── Activate (OTP → Compliance → Go Live) ───────────────────────────── */
 const handleActivate = async () => {
 if (!otp.trim()) { setError('Please enter the OTP from the Fatoora portal.'); return; }
 setError('');
 setBusy(true);
 setPhase('ACTIVATING');
 setLogs([]);

 try {
 const saved = localStorage.getItem('businessDetails');
 const biz = saved ? JSON.parse(saved) : {};

 // Step A — Compliance CSID
 log('🔗 Syncing with Fatoora portal...');
 const compliance = await requestComplianceCSID(otp.trim(), config.csr, 'PRODUCTION');
 log('✅ Compliance certificate received');

 const cfg1: ZatcaConfig = {
 ...config,
 complianceCsid: compliance.csid,
 complianceSecret: compliance.secret,
 requestId: compliance.requestId,
 status: 'COMPLIANCE_OBTAINED',
 };
 await persistConfig(cfg1);

  // Normalize business profile
  const normalizedProfile = {
    sellerName: biz.name?.trim(),
    vatNumber: (biz.vatNo || biz.gstin)?.trim(),
    crn: biz.crNo?.trim(),
    street: biz.address?.trim(),
    buildingNumber: biz.buildingNumber?.trim(),
    district: biz.district?.trim(),
    city: biz.city?.trim(),
    postalCode: biz.pincode?.trim(),
    countryCode: 'SA'
  };

  const requiredFields = ['sellerName', 'vatNumber', 'crn', 'street', 'buildingNumber', 'district', 'city', 'postalCode', 'countryCode'];
  const missingFields = requiredFields.filter(f => !(normalizedProfile as any)[f]);
  if (missingFields.length > 0) {
    console.error('[ZATCA BUSINESS PROFILE] Missing:', missingFields);
    throw new Error(`ZATCA_BUSINESS_PROFILE_INCOMPLETE\nMissing fields: ${missingFields.join(', ')}`);
  }

  let previousHash = ZATCA_GENESIS_HASH;

  // Step B — Sample invoices + ZATCA compliance: generate → validate → submit → repeat
  for (let i = 1; i <= 3; i++) {
    console.log('[ZATCA SAMPLE INPUT]', {
        sampleIndex: i,
        sellerName: normalizedProfile.sellerName,
        vatNumber: normalizedProfile.vatNumber,
        crn: normalizedProfile.crn,
    });

    let sample: any = null;
    try {
      sample = await generateComplianceSampleInvoice({
        sellerName: normalizedProfile.sellerName,
        vatNumber: normalizedProfile.vatNumber,
        crn: normalizedProfile.crn,
        street: normalizedProfile.street,
        buildingNumber: normalizedProfile.buildingNumber,
        citySubdivision: normalizedProfile.district,
        city: normalizedProfile.city,
        postalZone: normalizedProfile.postalCode,
        countryCode: normalizedProfile.countryCode,
        privateKeyPem: config.privateKey,
        complianceCsid: compliance.csid,
        invoiceIndex: i,
        previousInvoiceHash: previousHash
      });
      log(`📄 Sample ${i} generated`);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Sample generation failed';
      log(`❌ Sample ${i} generation failed: ${msg}`, false);
      throw err;
    }

    // Local validation before submitting
    try {
      localValidateSample(sample, normalizedProfile.crn, normalizedProfile.vatNumber);
      log(`✅ Sample ${i} local validation passed`);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Local validation failed';
      log(`❌ Sample ${i} local validation failed: ${msg}`, false);
      throw err;
    }

    // Submit THIS sample to ZATCA immediately — do not generate S2/S3 until this PASSES
    log(`🔍 Submitting Sample ${i} to ZATCA...`);
    try {
      await runComplianceChecks(compliance.csid, compliance.secret, [sample], 'PRODUCTION');
      log(`✅ Sample ${i} ZATCA check passed`);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'ZATCA compliance check failed';
      log(`❌ ${msg}`, false);
      throw err;
    }

    previousHash = sample.hash;
  }


 // Step D — Production CSID
 log('🚀 Requesting production certificate...');
 const prod = await getProductionCSID(
 compliance.requestId, compliance.csid, compliance.secret, 'PRODUCTION'
);
 log('✅ Production certificate received');

 const cfgFinal: ZatcaConfig = {
 ...cfg1,
 productionCsid: prod.productionCsid,
 productionSecret: prod.productionSecret,
 status: 'LIVE',
 };
 await persistConfig(cfgFinal);
 setConfig(cfgFinal);
 setPhase('LIVE');
 setOtp('');
 addToast('🎉 ZATCA e-Invoicing is now LIVE!', 'success');
 } catch (err) {
 const msg = err instanceof Error ? err.message : 'Activation failed';
 setError(msg);
 log(`❌ ${msg}`, false);
 setPhase('READY_FOR_OTP');
 } finally {
 setBusy(false);
 }
 };

 /* ── Toggle OFF ──────────────────────────────────────────────────────── */
 const handleDisable = () => {
 if (!window.confirm('This will stop ZATCA e-Invoicing. Are you sure?')) return;
 const reset = { ...EMPTY_CONFIG };
 persistConfig(reset);
 setConfig(reset);
 setPhase('OFF');
 setLogs([]);
 setOtp('');
 setError('');
 };

 /* ── Restore Panel ───────────────────────────────────────────────────── */
 const handleRestore = async () => {
 if (!restoreKey.trim() || !restoreCsid.trim()) {
 setError('Private key and Compliance CSID are required.');
 return;
 }
 setBusy(true);
 setError('');
 try {
 const restored: ZatcaConfig = {
 ...config,
 privateKey: restoreKey.trim(),
 complianceCsid: restoreCsid.trim(),
 complianceSecret: restoreSecret.trim() || undefined,
 requestId: restoreRequestId.trim() || undefined,
 status: 'COMPLIANCE_OBTAINED',
 environment: 'PRODUCTION',
 };
 await persistConfig(restored);
 setConfig(restored);
 setPhase('READY_FOR_OTP');
 setShowRestore(false);
 setRestoreKey(''); setRestoreCsid(''); setRestoreSecret(''); setRestoreRequestId('');
 addToast('✅ Credentials restored. Enter OTP to activate.', 'success');
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Restore failed.');
 } finally {
 setBusy(false);
 }
 };

 /* ── Derived ─────────────────────────────────────────────────────────── */
 const isLive = phase === 'LIVE';
 const isOff = phase === 'OFF';
 const isOtpPhase = phase === 'READY_FOR_OTP' || phase === 'ERROR';
 const isActivating = phase === 'ACTIVATING';

 /* ─────────────────────────────────────────────────────────────────────
 RENDER
 ───────────────────────────────────────────────────────────────────── */
 return (
 <div className="max-w-xl mx-auto py-8 space-y-6">

 {/* ── Header ─────────────────────────────────────────────────── */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-xl font-semibold dark:text-white tracking-tight">ZATCA E-Invoicing</h2>
 <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
 Saudi Arabia — Phase 2 Compliance
 </p>
 </div>
 {isLive && (
 <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
 Live
 </span>
)}
 </div>

 {/* ── Main Card ──────────────────────────────────────────────── */}
 <div className="rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">

 {/* Toggle Row */}
 <div className="flex items-center justify-between px-6 py-5">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLive ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
 <ShieldCheck size={20} className={isLive ? 'text-white' : 'text-slate-600'} />
 </div>
 <div>
 <p className="font-bold dark:text-white text-sm">ZATCA Integration</p>
 <p className="text-xs text-slate-700 dark:text-slate-300">
 {isLive ? 'Invoices reported in real-time' : isOtpPhase ? 'Enter OTP to go live' : isActivating ? 'Activating...' : 'Currently disabled'}
 </p>
 </div>
 </div>

 {/* Toggle Switch */}
 <button type="button"
 onClick={isLive ? handleDisable : isOff ? handleEnable : undefined}
 disabled={busy || isOtpPhase || isActivating}
 aria-label="Toggle ZATCA"
 className={`relative w-14 h-7 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20 ${
 isLive ? 'bg-emerald-500' :
 isOtpPhase || isActivating ? 'bg-slate-900 dark:bg-white' :
 'bg-slate-200 dark:bg-slate-700'
 } disabled:cursor-default`}
 >
 <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow ${
 isLive || isOtpPhase || isActivating ? 'translate-x-7' : 'translate-x-0'
 }`} />
 </button>
 </div>

 {/* Divider */}
 {!isOff && <div className="border-t border-slate-100 dark:border-slate-800"/>}

 {/* ── Step: Generating (busy + OFF → READY) ─────────────── */}
 {busy && isOff && (
 <div className="px-6 py-5 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
 <Loader2 size={16} className="text-slate-900 dark:text-white shrink-0"/>
 Setting up your device identity…
 </div>
)}

 {/* ── Step: OTP Input ────────────────────────────────────── */}
 {isOtpPhase && (
 <div className="px-6 py-5 space-y-4">
 <div className="flex items-start gap-3 p-3.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-600">
 <ChevronRight size={16} className="text-slate-900 dark:text-white shrink-0 mt-0.5"/>
 <p className="text-xs text-slate-900 dark:text-white leading-relaxed">
 Go to <strong>portal.zatca.gov.sa → Fatoora</strong>, generate an OTP for this device, and paste it below.
 </p>
 </div>

 <input
 type="text"
 value={otp}
 onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
 onKeyDown={(e) => e.key === 'Enter' && !busy && otp.trim().length >= 4 && handleActivate()}
 placeholder="000000"
 maxLength={6}
 className="w-full px-4 py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:border-slate-900 dark:focus:border-white outline-none font-mono text-2xl tracking-[0.5em] text-center"
 />

 <button type="button"
 onClick={handleActivate}
 disabled={busy || otp.trim().length < 4}
 className="w-full py-3.5 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2"
 >
 {busy
 ? <><Loader2 size={16} className=""/> Activating…</>
 : <><ShieldCheck size={16} /> Activate ZATCA</>
 }
 </button>

 {/* Reset link — always available mid-flow */}
 <button type="button"
 onClick={handleDisable}
 disabled={busy}
 className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-40"
 >
 <XCircle size={13} /> Reset & Start Over
 </button>
 </div>
)}

 {/* ── Step: Activating Log ───────────────────────────────── */}
 {(isActivating || logs.length > 0) && (
 <div className="px-6 py-5 space-y-3">
 <div className="bg-slate-950 rounded-xl p-4 space-y-2 max-h-52 overflow-y-auto">
 {logs.map((l, i) => (
 <div key={i} className={`text-xs font-mono ${l.ok ? 'text-emerald-400' : 'text-red-400'}`}>
 {l.msg}
 </div>
))}
 {busy && (
 <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
 <Loader2 size={12} className=""/> Please wait…
 </div>
)}
 </div>
 </div>
)}

 {/* ── Step: LIVE ─────────────────────────────────────────── */}
 {isLive && (
 <div className="px-6 py-5 space-y-3">
 <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
 <CheckCircle size={20} className="text-emerald-500 shrink-0"/>
 <div>
 <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">All invoices are compliant</p>
 <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">Reporting to ZATCA in real-time</p>
 </div>
 </div>
 <button type="button"
 onClick={handleDisable}
 className="w-full py-2.5 text-xs font-semibold text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl flex items-center justify-center gap-2"
 >
 <XCircle size={14} /> Disable & Reset ZATCA
 </button>
 </div>
)}
 </div>

 {/* ── Error Banner ───────────────────────────────────────────── */}
 {error && (
 <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-2xl">
 <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5"/>
 <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
 </div>
)}

 {/* ── Restore / Advanced ─────────────────────────────────────── */}
 {!isLive && (
 <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 overflow-hidden">
 <button type="button"
 onClick={() => setShowRestore((v) => !v)}
 className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
 >
 <span className="flex items-center gap-2 font-semibold">
 <Lock size={14} />
 Already have credentials? Restore without OTP
 </span>
 <span className="text-xs opacity-50">{showRestore ? '▲' : '▼'}</span>
 </button>

 {showRestore && (
 <div className="px-5 pb-5 pt-1 space-y-3 bg-slate-50 dark:bg-slate-900">
 <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
 Paste your existing EC private key and Compliance CSID if you've already onboarded on another device.
 </p>

 <div>
 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
 EC Private Key (PEM)
 </label>
 <textarea
 value={restoreKey}
 onChange={(e) => setRestoreKey(e.target.value)}
 placeholder={"-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"}
 rows={3}
 className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-xs font-mono focus:border-slate-900 dark:focus:border-white outline-none resize-none"
 />
 <button type="button"
 onClick={() => fileRef.current?.click()}
 className="mt-1 flex items-center gap-1.5 text-xs text-slate-900 dark:text-white hover:underline font-semibold"
 >
 <Upload size={11} /> Upload .pem file
 </button>
 <input
 ref={fileRef}
 type="file"
 accept=".pem,.key,.txt"
 className="hidden"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 const reader = new FileReader();
 reader.onload = (ev) => { const t = ev.target?.result as string; if (t) setRestoreKey(t.trim()); };
 reader.readAsText(file);
 }}
 />
 </div>

 <div>
 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
 Compliance CSID
 </label>
 <textarea
 value={restoreCsid}
 onChange={(e) => setRestoreCsid(e.target.value)}
 placeholder="Paste compliance CSID / certificate..."
 rows={2}
 className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-xs font-mono focus:border-slate-900 dark:focus:border-white outline-none resize-none"
 />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">Secret (optional)</label>
 <input
 type="password"
 value={restoreSecret}
 onChange={(e) => setRestoreSecret(e.target.value)}
 placeholder="API secret"
 className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-xs font-mono focus:border-slate-900 dark:focus:border-white outline-none"
 />
 </div>
 <div>
 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">Request ID (optional)</label>
 <input
 type="text"
 value={restoreRequestId}
 onChange={(e) => setRestoreRequestId(e.target.value)}
 placeholder="requestId"
 className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-xs font-mono focus:border-slate-900 dark:focus:border-white outline-none"
 />
 </div>
 </div>

 <button type="button"
 onClick={handleRestore}
 disabled={busy || !restoreKey.trim() || !restoreCsid.trim()}
 className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
 >
 {busy ? <Loader2 size={14} className=""/> : <RefreshCw size={14} />}
 Restore Credentials
 </button>
 </div>
)}
 </div>
)}
 </div>
);
};

export default ZatcaTab;
