import React from 'react';
import { X, CreditCard, FileCheck2, ImageOff } from 'lucide-react';
import { Challan } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface ChallanDetailsModalProps {
  challan: Challan | null;
  onClose: () => void;
  onPay: (challan: Challan) => void;
  onViewReceipt: (challan: Challan) => void;
}

export const ChallanDetailsModal: React.FC<ChallanDetailsModalProps> = ({
  challan,
  onClose,
  onPay,
  onViewReceipt,
}) => {
  const { t, translateViolation, formatDate, formatCurrency } = useLanguage();

  if (!challan) return null;

  const isPaid = challan.status === 'paid';
  const plate = challan.vehiclePlate || '';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8 text-[#172033] dark:text-[#F1F5F9]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] hover:bg-[#F7F9FC] dark:hover:bg-[#162238] transition"
          aria-label={t('common.close')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-4">
          <span className="gov-badge-info">{t('challanDetails.noticeBadge')}</span>
          <h2 className="text-xl font-extrabold text-[#172033] dark:text-[#F1F5F9] mt-2">
            {t('challanDetails.title')}
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono mt-0.5">
            {t('common.challanId')}: #{challan.id}
          </p>
        </div>

        {/* Challan Details Table */}
        <div className="border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-xs sm:text-sm mb-5 bg-[#F7F9FC] dark:bg-[#162238]/60">
          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('common.challanId')}</span>
            <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">#{challan.id}</span>
          </div>

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('common.vehicleNumber')}</span>
            <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9] bg-white dark:bg-[#0D1524] px-2.5 py-0.5 rounded border border-[#E2E8F0] dark:border-[#1E293B]">
              {plate}
            </span>
          </div>

          <div className="p-3.5 flex justify-between items-center gap-4">
            <span className="text-[#64748B] dark:text-[#94A3B8] font-medium shrink-0">{t('common.violation')}</span>
            <span className="font-bold text-[#DC2626] dark:text-[#F87171] text-right">
              {translateViolation(challan.violation)}
            </span>
          </div>

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('common.dateTime')}</span>
            <span className="text-[#172033] dark:text-[#F1F5F9] font-medium">
              {formatDate(challan.violationDatetime, true)}
            </span>
          </div>

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">Location</span>
            <span className="text-[#172033] dark:text-[#F1F5F9] font-medium text-right max-w-[240px] truncate">
              {challan.location || 'Traffic Division Zone'}
            </span>
          </div>

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('common.fineAmount')}</span>
            <span className="font-bold text-[#172033] dark:text-[#F1F5F9] font-mono text-base">
              {formatCurrency(Number(challan.fineAmount))}
            </span>
          </div>

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('common.status')}</span>
            <span className={isPaid ? 'gov-badge-success' : 'gov-badge-warning'}>
              {isPaid ? t('status.paid') : t('status.pending')}
            </span>
          </div>
        </div>

        {/* Violation Evidence */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wider">
              {t('challanDetails.evidenceSnapshot')}
            </h3>
            {challan.hasEvidence && (
              <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium">
                {t('challanDetails.aiCameraSystem')}
              </span>
            )}
          </div>

          {challan.hasEvidence && challan.evidenceUrl ? (
            <div className="rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F7F9FC] dark:bg-[#0D1524] relative">
              <img
                src={challan.evidenceUrl}
                alt={`Violation Evidence for ${challan.id}`}
                className="w-full max-h-56 object-contain mx-auto"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const fallback = document.getElementById(`fallback-msg-${challan.id}`);
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              <div
                id={`fallback-msg-${challan.id}`}
                style={{ display: 'none' }}
                className="p-8 text-center text-[#64748B] dark:text-[#94A3B8] text-xs"
              >
                <ImageOff className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                <p>{t('challanDetails.noEvidenceImg')}</p>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-[#F7F9FC] dark:bg-[#162238]/60 border border-[#E2E8F0] dark:border-[#1E293B] text-center text-[#64748B] dark:text-[#94A3B8] text-xs flex flex-col items-center justify-center gap-1.5">
              <ImageOff className="w-6 h-6 text-[#94A3B8]" />
              <p className="font-medium text-[#172033] dark:text-[#F1F5F9]">{t('challanDetails.noEvidenceImg')}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {isPaid ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewReceipt(challan);
              }}
              className="flex-1 btn-success text-xs py-3 flex items-center justify-center gap-2"
            >
              <FileCheck2 className="w-4 h-4" /> {t('common.viewReceipt')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onPay(challan);
              }}
              className="flex-1 btn-primary text-xs py-3 flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" /> {t('common.payNow')}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs px-5 py-3"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
