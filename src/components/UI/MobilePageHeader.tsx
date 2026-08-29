import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import clsx from 'clsx';

interface MobilePageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  className?: string;
}

const MobilePageHeader: React.FC<MobilePageHeaderProps> = ({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightSlot,
  className,
}) => {
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate(-1));

  return (
    <div className={clsx('flex items-center gap-3 mb-6', className)}>
      {showBack && (
        <button
          type="button"
          onClick={handleBack}
          className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <ChevronLeft size={22} className="text-slate-700 dark:text-slate-300" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
};

export default MobilePageHeader;
