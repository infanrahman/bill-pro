import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ShieldCheck, Key, CheckCircle, Loader2, Rocket, AlertTriangle, XCircle, Info
} from 'lucide-react';
import { generateCSR, requestComplianceCSID, runComplianceChecks, getProductionCSID, type ZatcaConfig } from '../../../services/zatcaApi';
import { generateComplianceSampleInvoice } from '../../../services/zatcaComplianceSamples';
import { useNotification } from '../../../contexts/NotificationContext';

type Step = 'CSR' | 'OTP' | 'LIVE' | 'DONE';

const ZatcaTab: React.FC = () => {
    const { t } = useTranslation();
    const { addToast } = useNotification();

    const [config, setConfig] = useState<ZatcaConfig>({
        csr: '',
        privateKey: '',
        status: 'NOT_ONBOARDED',
        environment: 'PRODUCTION',
    });
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState<Step>('CSR');
    const [liveLog, setLiveLog] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState('');

    const saveConfig = (newConfig: ZatcaConfig) => {
        setConfig(newConfig);
        localStorage.setItem('zatca_config', JSON.stringify(newConfig));
    };

    useEffect(() => {
        const stored = localStorage.getItem('zatca_config');
        if (stored) {
            const parsed: ZatcaConfig = JSON.parse(stored);
            setConfig(parsed);
            if (parsed.status === 'CSR_GENERATED') setCurrentStep('OTP');
            if (parsed.status === 'COMPLIANCE_OBTAINED') setCurrentStep('LIVE');
            if (parsed.status === 'LIVE') setCurrentStep('DONE');
        }
    }, []);

    const log = (msg: string) => setLiveLog((prev) => [...prev, msg]);

    // ── Step 1: Generate Keys ──────────────────────────────────────────
    const handleGenerateCSR = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const saved = localStorage.getItem('businessDetails');
            const business = saved ? JSON.parse(saved) : {};

            if (!business.gstin) {
                setErrorMsg(t('zatca.vat_missing', 'Please add your VAT registration number in Business Details first.'));
                setLoading(false);
                return;
            }

            const keys = await generateCSR({
                commonName: business.name || 'POS-Device',
                organizationName: business.name || 'My Business',
                organizationUnitName: business.address || 'Branch',
                countryName: 'SA',
                serialNumber: `1-${business.gstin}|2-${crypto.randomUUID()}|3-1000`,
                registeredAddress: business.address || 'Riyadh, Saudi Arabia',
                businessCategory: 'Retail',
            });

            const newConfig: ZatcaConfig = {
                ...config,
                csr: keys.csr,
                privateKey: keys.privateKey,
                status: 'CSR_GENERATED',
                environment: 'PRODUCTION',
            };
            saveConfig(newConfig);
            setCurrentStep('OTP');
            addToast(t('zatca.csr_success', 'Keys generated successfully!'), 'success');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'CSR generation failed');
        } finally {
            setLoading(false);
        }
    };

    // ── Step 2: Submit OTP (get compliance CSID) ──────────────────────
    const handleOtpSubmit = async () => {
        if (!otp.trim()) {
            setErrorMsg(t('zatca.otp_missing', 'Please enter the OTP from the Fatoora portal.'));
            return;
        }
        setLoading(true);
        setErrorMsg('');
        try {
            const result = await requestComplianceCSID(otp.trim(), config.csr, 'PRODUCTION');

            const newConfig: ZatcaConfig = {
                ...config,
                complianceCsid: result.csid,
                complianceSecret: result.secret,
                requestId: result.requestId,
                status: 'COMPLIANCE_OBTAINED',
            };
            saveConfig(newConfig);
            setCurrentStep('LIVE');
            addToast(t('zatca.onboard_success', 'Compliance certificate received!'), 'success');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Onboarding failed.');
        } finally {
            setLoading(false);
        }
    };

    // ── Step 3: Go Live (auto compliance checks + production CSID) ─────
    const handleGoLive = async () => {
        setLoading(true);
        setLiveLog([]);
        setErrorMsg('');

        try {
            const saved = localStorage.getItem('businessDetails');
            const business = saved ? JSON.parse(saved) : {};

            // 3a. Generate 3 sample invoices for compliance
            log('📄 Generating compliance sample invoices...');
            const samples = await Promise.all([1, 2, 3].map((i) =>
                generateComplianceSampleInvoice({
                    sellerName: business.name || 'My Business',
                    vatNumber: business.gstin || config.csr,
                    privateKeyPem: config.privateKey,
                    invoiceIndex: i,
                })
            ));
            log('✅ 3 sample invoices generated');

            // 3b. Run compliance checks
            log('🔍 Running ZATCA compliance checks...');
            await runComplianceChecks(
                config.complianceCsid!,
                config.complianceSecret!,
                samples,
                'PRODUCTION'
            );
            log('✅ Compliance checks passed');

            // 3c. Exchange for production CSID
            log('🔑 Requesting Production Certificate...');
            const prod = await getProductionCSID(
                config.requestId!,
                config.complianceCsid!,
                config.complianceSecret!,
                'PRODUCTION'
            );
            log('✅ Production certificate received!');
            log('🚀 ZATCA e-Invoicing is now LIVE!');

            const newConfig: ZatcaConfig = {
                ...config,
                productionCsid: prod.productionCsid,
                productionSecret: prod.productionSecret,
                status: 'LIVE',
            };
            saveConfig(newConfig);
            setCurrentStep('DONE');
            addToast('🎉 ZATCA e-Invoicing is now LIVE!', 'success');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Go Live failed';
            log(`❌ Error: ${msg}`);
            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    };

    const isLive = config.status === 'LIVE';

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
                <div>
                    <h2 className="text-xl font-semibold dark:text-white flex items-center gap-2">
                        <ShieldCheck className="text-emerald-500" size={22} />
                        ZATCA E-Invoicing
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">Saudi Arabia — Phase 2 Simplified Tax Invoicing</p>
                </div>
                {isLive && (
                    <span className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> LIVE
                    </span>
                )}
            </div>

            {/* Info Box */}
            {!isLive && (
                <div className="flex gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <div>
                        On the <strong>Fatoora Portal</strong>, go to <em>Devices → Onboard New Device</em> to generate your OTP. Have it ready for Step 2.
                    </div>
                </div>
            )}

            {/* Steps */}
            <div className="space-y-4">
                {/* ── STEP 1 ── */}
                <StepCard
                    number={1}
                    title="Generate Cryptographic Keys"
                    description="Creates your device's private key and CSR — this is your digital identity for ZATCA."
                    done={currentStep !== 'CSR'}
                    active={currentStep === 'CSR'}
                >
                    {currentStep === 'CSR' && (
                        <button
                            onClick={handleGenerateCSR}
                            disabled={loading}
                            className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Key size={18} />}
                            Generate Keys
                        </button>
                    )}
                </StepCard>

                {/* ── STEP 2 ── */}
                <StepCard
                    number={2}
                    title="Enter Fatoora Portal OTP"
                    description="Login to zatca.gov.sa → Fatoora Portal → Onboard Device → Copy the OTP here."
                    done={currentStep === 'LIVE' || currentStep === 'DONE'}
                    active={currentStep === 'OTP'}
                    locked={currentStep === 'CSR'}
                >
                    {currentStep === 'OTP' && (
                        <div className="mt-4 space-y-3">
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter 6-digit OTP from Fatoora Portal"
                                maxLength={20}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:border-blue-500 outline-none font-mono text-lg tracking-widest text-center transition-colors"
                            />
                            <button
                                onClick={handleOtpSubmit}
                                disabled={loading || !otp.trim()}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                                Get Compliance Certificate
                            </button>
                        </div>
                    )}
                </StepCard>

                {/* ── STEP 3 ── */}
                <StepCard
                    number={3}
                    title="Go Live"
                    description="Automatically runs compliance checks and upgrades to a Production Certificate. All invoices will be reported to ZATCA in real-time."
                    done={currentStep === 'DONE'}
                    active={currentStep === 'LIVE'}
                    locked={currentStep === 'CSR' || currentStep === 'OTP'}
                >
                    {currentStep === 'LIVE' && (
                        <div className="mt-4 space-y-3">
                            <button
                                onClick={handleGoLive}
                                disabled={loading}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />}
                                {loading ? 'Activating...' : '🚀 Go Live'}
                            </button>
                            {liveLog.length > 0 && (
                                <div className="bg-slate-900 rounded-xl p-4 space-y-1 text-xs font-mono">
                                    {liveLog.map((line, i) => (
                                        <div key={i} className="text-emerald-400">{line}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </StepCard>
            </div>

            {/* Error */}
            {errorMsg && (
                <div className="flex gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>{errorMsg}</div>
                </div>
            )}

            {/* Done State */}
            {currentStep === 'DONE' && (
                <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                    <CheckCircle size={48} className="text-emerald-500 mx-auto" />
                    <h3 className="text-lg font-black text-emerald-700 dark:text-emerald-400">ZATCA E-Invoicing is LIVE!</h3>
                    <p className="text-sm text-slate-500">All future invoices will be automatically reported to ZATCA in real-time.</p>
                    <button
                        onClick={() => {
                            if (window.confirm('This will revoke your production certificate. Are you sure?')) {
                                const reset: ZatcaConfig = { csr: '', privateKey: '', status: 'NOT_ONBOARDED', environment: 'PRODUCTION' };
                                saveConfig(reset);
                                setCurrentStep('CSR');
                                setLiveLog([]);
                            }
                        }}
                        className="mt-2 text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 mx-auto transition-colors"
                    >
                        <XCircle size={13} /> Reset &amp; Re-onboard
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Helper Component ──────────────────────────────────────────────────────────
interface StepCardProps {
    number: number;
    title: string;
    description: string;
    done: boolean;
    active: boolean;
    locked?: boolean;
    children?: React.ReactNode;
}

const StepCard: React.FC<StepCardProps> = ({ number, title, description, done, active, locked, children }) => (
    <div className={`p-5 rounded-2xl border-2 transition-all ${
        done
            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
            : active
            ? 'border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 shadow-lg shadow-blue-100/50 dark:shadow-none'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 opacity-50'
    }`}>
        <div className="flex items-start gap-4">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                done
                    ? 'bg-emerald-500 text-white'
                    : active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500'
            }`}>
                {done ? <CheckCircle size={18} /> : number}
            </div>
            <div className="flex-1">
                <h3 className={`font-bold ${done ? 'text-emerald-700 dark:text-emerald-400' : 'dark:text-white'}`}>
                    {title}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">{description}</p>
                {!locked && children}
            </div>
        </div>
    </div>
);

export default ZatcaTab;
