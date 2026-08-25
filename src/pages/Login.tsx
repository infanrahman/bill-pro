import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, ArrowRight, AlertCircle, ShieldCheck, Box, BarChart3, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Login: React.FC = () => {
    const { login } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const success = await login(username, password);
            if (success) {
                navigate('/');
            } else {
                setError(t('login.invalid_credentials'));
            }
        } catch (err: any) {
            console.error("Login attempt failed:", err);
            setError(t('login.error_login'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen w-full font-sans bg-white dark:bg-slate-950 overflow-hidden">
            
            {/* Left Side - Full Screen Details & Branding */}
            <div className="w-full md:w-5/12 bg-slate-900 dark:bg-black p-12 md:p-20 text-white flex flex-col justify-center relative overflow-hidden h-screen">
                <div className="absolute top-0 left-0 w-full h-full opacity-5" style={{ backgroundImage: 'url("/pattern-bg.png")', backgroundSize: '30px' }}></div>
                <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-slate-800/50 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col h-full max-w-lg mx-auto w-full justify-center">
                    <div className="mb-auto mt-4">
                        <div className="mb-12 w-16 h-16 rounded-2xl flex items-center justify-center bg-white text-slate-900 shadow-2xl border border-white/20">
                            <ShieldCheck size={36} strokeWidth={2.5} />
                        </div>
                        
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 tracking-tight leading-tight">
                            {t('login.brand_title')}
                        </h1>
                        <p className="text-slate-300 text-lg md:text-xl leading-relaxed font-medium mb-16 max-w-md">
                            {t('login.brand_subtitle')}
                        </p>
                    </div>
                    
                    {/* App Details / Features */}
                    <div className="space-y-8 mb-auto">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/10 rounded-2xl border border-white/5">
                                <Box size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-base">Professional Inventory</h3>
                                <p className="text-slate-600 text-sm mt-1">Track stock levels in real-time</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/10 rounded-2xl border border-white/5">
                                <BarChart3 size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-base">Advanced Reporting</h3>
                                <p className="text-slate-600 text-sm mt-1">Actionable business insights</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/10 rounded-2xl border border-white/5">
                                <Users size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-base">Staff Management</h3>
                                <p className="text-slate-600 text-sm mt-1">Secure role-based access</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex items-center gap-4 text-xs font-bold text-slate-700 pb-4">
                        <div className="w-12 h-[2px] bg-slate-800"></div>
                        <span className="tracking-widest uppercase">{t('login.secure_reliable')}</span>
                    </div>
                </div>
            </div>

            {/* Right Side - Full Screen Login Form */}
            <div className="w-full md:w-7/12 p-6 md:p-24 flex flex-col justify-center bg-white dark:bg-slate-900 h-screen relative">
                <div className="max-w-lg mx-auto w-full">
                    <div className="mb-12">
                        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">{t('login.welcome_back')}</h2>
                        <p className="text-slate-700 dark:text-slate-300 font-medium text-lg">{t('login.signin_text')}</p>
                    </div>

                    {error && (
                        <div className="mb-8 p-5 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl flex items-center gap-4 text-sm font-semibold shadow-lg">
                            <AlertCircle size={24} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-7">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">{t('users.username')}</label>
                            <div className="relative group">
                                <User className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" size={24} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:border-slate-900 dark:focus:border-white focus:bg-white dark:focus:bg-slate-900 outline-none font-bold text-slate-900 dark:text-white placeholder-slate-400 transition-all text-lg"
                                    placeholder={t('login.enter_username')}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">{t('users.password')}</label>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-600 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" size={24} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:border-slate-900 dark:focus:border-white focus:bg-white dark:focus:bg-slate-900 outline-none font-bold text-slate-900 dark:text-white placeholder-slate-400 transition-all text-lg"
                                    placeholder={t('login.password_placeholder')}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-5 mt-8 rounded-2xl font-bold text-xl text-white flex items-center justify-center gap-3 transition-all shadow-xl
                                ${loading
                                    ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none'
                                    : 'bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 hover:shadow-2xl active:scale-[0.98]'
                                }
                            `}
                        >
                            {loading ? (
                                <span className="w-7 h-7 border-4 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900 rounded-full animate-spin" />
                            ) : (
                                <>
                                    {t('login.sign_in_btn')} <ArrowRight size={26} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-16 text-center">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t('login.secure_msg')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
