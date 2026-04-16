import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
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
            setError(t('login.error_login') + ": " + (err.message || String(err)));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-[30%] -right-[10%] w-[800px] h-[800px] bg-blue-100 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] bg-cyan-100 rounded-full blur-3xl opacity-50" />
            </div>

            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex overflow-hidden relative z-10 border border-slate-100">

                {/* Left Side - Hero / Brand */}
                <div className="hidden md:flex flex-col justify-center w-1/2 bg-gradient-to-br from-blue-600 to-cyan-500 p-12 text-white relative">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('/pattern-bg.png')] opacity-10 mix-blend-overlay"></div>
                    <div className="relative z-10">
                        <div className="mb-6 bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                            <ShieldCheck size={40} className="text-white" />
                        </div>
                        <h1 className="text-4xl font-bold mb-4 font-sans tracking-tight">{t('login.brand_title')}</h1>
                        <p className="text-blue-100 text-lg leading-relaxed opacity-90">
                            {t('login.brand_subtitle')}
                        </p>

                        <div className="mt-12 flex items-center gap-3 text-sm font-medium text-blue-100 opacity-75">
                            <div className="w-8 h-[1px] bg-blue-200"></div>
                            <span>{t('login.secure_reliable')}</span>
                        </div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="w-full md:w-1/2 p-8 md:p-12 bg-white flex flex-col justify-center">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('login.welcome_back')}</h2>
                        <p className="text-slate-500 text-sm">{t('login.signin_text')}</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3 text-sm border border-red-100 animate-fadeIn">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">{t('users.username')}</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 placeholder-slate-400"
                                    placeholder={t('login.enter_username')}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">{t('users.password')}</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 placeholder-slate-400"
                                    placeholder={t('login.password_placeholder')}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 mt-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30
                                ${loading
                                    ? 'bg-blue-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 hover:shadow-blue-500/40 active:scale-[0.98]'
                                }
                            `}
                        >
                            {loading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {t('login.sign_in_btn')} <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-slate-400">
                            {t('login.secure_msg')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
