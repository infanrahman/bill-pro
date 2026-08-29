import React from 'react';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface MobileListItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  showChevron?: boolean;
  onClick?: () => void;
  className?: string;
  destructive?: boolean;
}

const MobileListItem: React.FC<MobileListItemProps> = ({
  icon,
  title,
  subtitle,
  rightContent,
  showChevron = false,
  onClick,
  className,
  destructive = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-4 px-4 py-3.5 min-h-[60px] active:bg-slate-100 dark:active:bg-slate-800 transition-colors text-left',
        !onClick && 'cursor-default',
        className
      )}
    >
      {icon && (
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={clsx(
          'text-sm font-semibold truncate',
          destructive ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
        )}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {rightContent && <div className="shrink-0 ml-2">{rightContent}</div>}
      {showChevron && (
        <ChevronRight size={16} className="shrink-0 text-slate-400" />
      )}
    </button>
  );
};

export default MobileListItem;
