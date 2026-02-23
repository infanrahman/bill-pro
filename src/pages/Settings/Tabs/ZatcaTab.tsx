import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Server, Key, CheckCircle, Globe } from 'lucide-react';
import { generateCSR, requestComplianceCSID, type ZatcaConfig } from '../../../services/zatcaApi';
import { useNotification } from '../../../contexts/NotificationContext';

const ZatcaTab: React.FC = () => {
    const { t } = useTranslation();
    const { addToast } = useNotification();
    const [isEnabled, setIsEnabled] = useState(false);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<ZatcaConfig>({
        csr: '',
        privateKey: '',
        status: 'NOT_ONBOARDED'
    });

    const saveConfig = (newConfig: ZatcaConfig) => {
        setConfig(newConfig);
        localStorage.setItem('zatca_config', JSON.stringify(newConfig));
    };

    const toggleOnlineMode = () => {
        const newState = !isEnabled;
        setIsEnabled(newState);
        localStorage.setItem('zatca_enabled', JSON.stringify(newState));
    };

    // Load initial state
    useEffect(() => {
        const storedConfig = localStorage.getItem('zatca_config');
        const storedEnabled = localStorage.getItem('zatca_enabled');

        if (storedConfig) {
            setConfig(JSON.parse(storedConfig));
        }

        if (storedEnabled) {
            setIsEnabled(JSON.parse(storedEnabled));
        }
    }, []);

    const handleGenerateCSR = async () => {
        setLoading(true);
        try {
            // Get business details for real CSR data
            const savedDetails = localStorage.getItem('businessDetails');
            const business = savedDetails ? JSON.parse(savedDetails) : {};

            if (!business.gstin) {
                addToast(t('zatca.vat_missing'), 'error');
                setLoading(false);
                return;
            }

            const keys = await generateCSR({
                commonName: business.name || 'TSP-123',
                organizationName: business.name || 'My Shop',
                organizationUnitName: business.address || 'Branch',
                countryName: business.country === 'Saudi Arabia' ? 'SA' : 'SA',
                serialNumber: `1-${business.gstin}|2-UUID|3-1000`,
                registeredAddress: business.address || 'Riyadh',
                businessCategory: 'Retail'
            });

            saveConfig({
                ...config,
                csr: keys.csr,
                privateKey: keys.privateKey,
                status: 'CSR_GENERATED'
            });
            addToast(t('zatca.csr_success'), 'success');
        } catch (error) {
            addToast(t('zatca.csr_failed'), 'error');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOnboard = async () => {
        if (!otp) {
            addToast(t('zatca.otp_missing'), 'error');
            return;
        }

        setLoading(true);
        try {
            // Real API Call
            const result = await requestComplianceCSID(otp, config.csr);

            const newConfig: ZatcaConfig = {
                ...config,
                complianceCsid: result.csid,
                complianceSecret: result.secret,
                requestId: result.requestId,
                status: 'COMPLIANCE_OBTAINED'
            };

            saveConfig(newConfig);
            addToast(t('zatca.onboard_success'), 'success');
        } catch (error) {
            console.error("Onboarding Failed", error);
            const msg = error instanceof Error ? error.message : 'Unknown Error';
            addToast(`${t('zatca.onboard_failed')}: ${msg}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
                <div>
                    <h2 className="text-xl font-semibold dark:text-white">{t('zatca.title')}</h2>
                    <p className="text-sm text-slate-500">{t('zatca.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isEnabled ? 'text-green-600' : 'text-slate-400'}`}>
                        {isEnabled ? t('zatca.online_mode') : t('zatca.offline_mode')}
                    </span>
                    <button
                        onClick={toggleOnlineMode}
                        className={`w-12 h-6 rounded-full transition-colors relative ${isEnabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                    >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isEnabled ? 'left-7' : 'left-1'
                            }`} />
                    </button>
                </div>
            </div>

            {isEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Status Card */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h3 className="font-medium mb-4 flex items-center gap-2 dark:text-white">
                                <ShieldCheck size={18} /> {t('zatca.integration_status')}
                            </h3>

                            <div className="space-y-4">
                                <StatusStep
                                    label={t('zatca.step_csr')}
                                    done={config.status !== 'NOT_ONBOARDED'}
                                />
                                <StatusStep
                                    label={t('zatca.step_csid')}
                                    done={['COMPLIANCE_OBTAINED', 'CHECKED', 'LIVE'].includes(config.status)}
                                />
                                <StatusStep
                                    label={t('zatca.step_checks')}
                                    done={['CHECKED', 'LIVE'].includes(config.status)}
                                />
                                <StatusStep
                                    label={t('zatca.step_production')}
                                    done={config.status === 'LIVE'}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions Area */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Step 1: CSR */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg dark:text-white flex items-center gap-2">
                                        <Key size={20} className="text-blue-500" />
                                        {t('zatca.sec_keys_title')}
                                    </h3>
                                    <p className="text-slate-500 text-sm">{t('zatca.sec_keys_desc')}</p>
                                    <p className="text-xs text-orange-500 mt-1">{t('zatca.sec_keys_note')}</p>
                                </div>
                                <button
                                    onClick={handleGenerateCSR}
                                    disabled={loading || CONFIG_STATUS_ORDER[config.status] >= 2}
                                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                                >
                                    {config.status === 'NOT_ONBOARDED' ? t('zatca.btn_generate') : t('zatca.btn_regenerate')}
                                </button>
                            </div>
                            {config.csr && (
                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded text-xs font-mono text-slate-500 break-all h-20 overflow-y-auto">
                                    {config.csr}
                                </div>
                            )}
                        </div>

                        {/* Step 2: Onboarding */}
                        <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 ${CONFIG_STATUS_ORDER[config.status] < 1 ? 'opacity-50 pointer-events-none' : ''}`}>
                            <h3 className="font-semibold text-lg dark:text-white flex items-center gap-2 mb-4">
                                <Server size={20} className="text-purple-500" />
                                {t('zatca.onboarding_title')}
                            </h3>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {t('zatca.otp_label')}
                                    </label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder={t('zatca.otp_placeholder', '123456')}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">{t('zatca.otp_note')}</p>
                                </div>
                                <button
                                    onClick={handleOnboard}
                                    disabled={loading || CONFIG_STATUS_ORDER[config.status] >= 2}
                                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? t('zatca.btn_connecting') : t('zatca.btn_onboard')}
                                </button>
                            </div>
                        </div>

                        {/* Step 3: Production */}
                        <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 ${CONFIG_STATUS_ORDER[config.status] < 2 ? 'opacity-50 pointer-events-none' : ''}`}>
                            <h3 className="font-semibold text-lg dark:text-white flex items-center gap-2 mb-4">
                                <Globe size={20} className="text-emerald-500" />
                                {t('zatca.production_title')}
                            </h3>
                            <p className="text-sm text-slate-500 mb-4">{t('zatca.production_desc')}</p>
                            <button
                                disabled={true}
                                className="w-full py-3 bg-emerald-600 text-white rounded-lg opacity-50 cursor-not-allowed"
                            >
                                {t('zatca.btn_compliance_check')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatusStep: React.FC<{ label: string; done: boolean }> = ({ label, done }) => (
    <div className="flex items-center gap-3">
        {done ? (
            <CheckCircle size={20} className="text-green-500" />
        ) : (
            <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
        )}
        <span className={done ? 'text-slate-700 dark:text-white font-medium' : 'text-slate-400'}>
            {label}
        </span>
    </div>
);

const CONFIG_STATUS_ORDER = {
    'NOT_ONBOARDED': 0,
    'CSR_GENERATED': 1,
    'COMPLIANCE_OBTAINED': 2,
    'CHECKED': 3,
    'LIVE': 4
};

export default ZatcaTab;
