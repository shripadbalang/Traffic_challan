import React from 'react';
import { ChallanStatus } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface BadgeProps {
  status?: ChallanStatus | string;
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'plate';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, children, variant, className = '' }) => {
  const { t } = useLanguage();
  let style = 'bg-[#F5F7FB] dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#1E293B]';

  if (variant === 'plate') {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-md bg-[#FFFBEB] dark:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] font-mono font-bold text-xs border border-[#F59E0B] dark:border-[#3B82F6] shadow-sm ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] dark:bg-[#38BDF8] mr-1.5" />
        {children || status}
      </span>
    );
  }

  const normalized = (status || '').toLowerCase();

  if (variant === 'success' || normalized === 'paid' || normalized === 'approved') {
    style = 'bg-[#ECFDF5] text-[#16856B] border-[#A7F3D0] dark:bg-[#10B981]/15 dark:text-[#34D399] dark:border-[#10B981]/30';
  } else if (
    variant === 'warning' ||
    normalized === 'pending' ||
    normalized === 'unpaid' ||
    normalized === 'under_review'
  ) {
    style = 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-[#F59E0B]/15 dark:text-[#FBBF24] dark:border-[#F59E0B]/30';
  } else if (
    variant === 'danger' ||
    normalized === 'disputed' ||
    normalized === 'rejected' ||
    normalized === 'high' ||
    normalized === 'critical'
  ) {
    style = 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] dark:bg-[#EF4444]/15 dark:text-[#F87171] dark:border-[#EF4444]/30';
  } else if (variant === 'info' || normalized === 'ai' || normalized === 'low' || normalized === 'medium') {
    style = 'bg-[#EFF6FF] text-[#174EA6] border-[#BFDBFE] dark:bg-[#3B82F6]/15 dark:text-[#60A5FA] dark:border-[#3B82F6]/30';
  }

  let defaultLabel = '';
  if (normalized === 'paid') {
    defaultLabel = t('status.paid');
  } else if (normalized === 'unpaid' || normalized === 'pending') {
    defaultLabel = t('status.pending');
  } else if (status) {
    defaultLabel = status.charAt(0).toUpperCase() + status.slice(1);
  }

  const label = children || defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${style} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-85 shrink-0" />
      {label}
    </span>
  );
};
