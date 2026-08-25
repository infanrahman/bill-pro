import React from 'react';

const LoadingScreen: React.FC = () => {
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900 dark:bg-white">
 {/* Royal Blue Gradient Background */}
 <div className="absolute inset-0 z-0 to-indigo-900 animate-[pulse_10s_ease-in-out_infinite]"/>

 {/* subtle pattern overlay */}
 <div className="absolute inset-0 z-10 opacity-5 bg-[url('/pattern-bg.png')] mix-blend-overlay"/>

 {/* Main Content Container */}
 <div className="relative z-20 flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4">

 {/* Logo Section - Text 'Billing Pro' */}
 <div className="mb-12 p-1.5 rounded-full to-purple-500/30 ring-1 ring-white/10">
 <div className="bg-slate-900 w-32 h-32 rounded-full flex flex-col items-center justify-center relative overflow-hidden group border border-white/5">
 <div className="absolute inset-0 to-purple-600/20 opacity-100 md:opacity-0 md:group-hover:opacity-100"></div>
 <div className="relative z-10 text-center transform group-">
 <div className="text-2xl font-semibold text-transparent bg-clip-text to-cyan-300 leading-none tracking-tight">
 Billing
 </div>
 <div className="text-lg font-bold text-white/90 tracking-wider uppercase text-[0.65rem] mt-1">
 Pro
 </div>
 </div>
 </div>
 </div>

 {/* Typography Section */}
 <div className="text-center space-y-4">
 {/* App Title */}
 <div className="space-y-1">
 <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-[0.4em] uppercase font-sans mb-2">
 Professional Billing Solution
 </h2>
 <h3 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight font-sans drop- relative">
 <span className="bg-clip-text text-transparent from-white">Billing</span>
 <span className="text-slate-900 dark:text-white text-6xl">.</span>
 <span className="bg-clip-text text-transparent to-cyan-300">Pro</span>
 </h3>
 </div>

 {/* Arabic Welcome - Elegant & Professional */}
 <p className="text-xl text-slate-700/80 dark:text-slate-300/80 font-arabic tracking-wide mt-4 font-light">
 نظام المحاسبة والفواتير المتكامل
 </p>
 </div>

 {/* Professional Loading Indicator */}
 <div className="absolute bottom-24 w-64 flex flex-col items-center gap-3">
 <div className="h-1 w-full bg-slate-900 dark:bg-white rounded-full overflow-hidden border border-slate-900/30 dark:border-white/30">
 <div className="h-full from-transparent to-transparent w-1/2 animate-[shimmer_1.5s_infinite_linear]"></div>
 </div>
 <p className="text-[10px] text-slate-700/70 dark:text-slate-300/70 tracking-wide font-medium uppercase font-sans">
 Initializing System...
 </p>
 </div>
 </div>

 {/* Footer */}
 <div className="absolute bottom-6 w-full text-center z-20 space-y-1">
 <p className="text-[10px] text-white/20 tracking-wider font-light uppercase">
 &copy; {new Date().getFullYear()} Enterprise Edition
 </p>
 <p className="text-[10px] text-white/10 tracking-wider font-light uppercase">
 All rights reserved to EPoint Khamis Mushait
 </p>
 </div>
 </div>
);
};

export default LoadingScreen;
