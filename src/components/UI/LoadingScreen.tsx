import React from 'react';

const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-blue-950">
            {/* Royal Blue Gradient Background */}
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 animate-[pulse_10s_ease-in-out_infinite]" />

            {/* subtle pattern overlay */}
            <div className="absolute inset-0 z-10 opacity-5 bg-[url('/pattern-bg.png')] mix-blend-overlay" />

            {/* Main Content Container */}
            <div className="relative z-20 flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4 animate-fade-in-up">

                {/* Logo Section - Text 'Billing Pro' */}
                <div className="mb-12 p-1.5 rounded-full bg-gradient-to-tr from-blue-400/30 to-purple-500/30 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
                    <div className="bg-slate-900/40 w-32 h-32 rounded-full flex flex-col items-center justify-center relative overflow-hidden group border border-white/5">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <div className="relative z-10 text-center transform transition-transform duration-700 group-hover:scale-110">
                            <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 leading-none tracking-tighter">
                                Billing
                            </div>
                            <div className="text-lg font-bold text-white/90 tracking-widest uppercase text-[0.65rem] mt-1">
                                Pro
                            </div>
                        </div>
                    </div>
                </div>

                {/* Typography Section */}
                <div className="text-center space-y-4">
                    {/* App Title */}
                    <div className="space-y-1">
                        <h2 className="text-xs font-bold text-blue-200 tracking-[0.4em] uppercase font-sans mb-2">
                            Professional Billing Solution
                        </h2>
                        <h3 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight font-sans drop-shadow-xl relative">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-50 to-blue-200">Billing</span>
                            <span className="text-blue-500 text-6xl">.</span>
                            <span className="bg-clip-text text-transparent bg-gradient-to-tr from-blue-400 to-cyan-300">Pro</span>
                        </h3>
                    </div>

                    {/* Arabic Welcome - Elegant & Professional */}
                    <p className="text-xl text-blue-200/80 font-arabic tracking-wide mt-4 font-light">
                        نظام المحاسبة والفواتير المتكامل
                    </p>
                </div>

                {/* Professional Loading Indicator */}
                <div className="absolute bottom-24 w-64 flex flex-col items-center gap-3">
                    <div className="h-1 w-full bg-blue-900/50 rounded-full overflow-hidden backdrop-blur-sm border border-blue-700/30">
                        <div className="h-full bg-gradient-to-r from-transparent via-blue-400 to-transparent w-1/2 animate-[shimmer_1.5s_infinite_linear]"></div>
                    </div>
                    <p className="text-[10px] text-blue-300/70 tracking-[0.2em] font-medium uppercase font-sans">
                        Initializing System...
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-6 w-full text-center z-20 space-y-1">
                <p className="text-[10px] text-white/20 tracking-widest font-light uppercase">
                    &copy; {new Date().getFullYear()} Enterprise Edition
                </p>
                <p className="text-[10px] text-white/10 tracking-widest font-light uppercase">
                    All rights reserved to EPoint Khamis Mushait
                </p>
            </div>
        </div>
    );
};

export default LoadingScreen;
