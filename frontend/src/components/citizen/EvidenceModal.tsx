import React, { useState, useEffect } from 'react';
import { X, ImageOff, ShieldAlert } from 'lucide-react';
import { Challan } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { buildApiUrl } from '../../services/api';

interface EvidenceModalProps {
  challan: Challan | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ challan, onClose }) => {
  const [imageError, setImageError] = useState(false);
  const { t, translateViolation, formatDate, formatCurrency } = useLanguage();

  useEffect(() => {
    setImageError(false);
  }, [challan?.id]);

  if (!challan) return null;

  const rawUrl = challan.evidenceUrl || (challan.id ? `/files/evidence/challan_${challan.id}.jpg` : '');
  const mediaUrl = rawUrl ? buildApiUrl(rawUrl) : '';
  const showFallback = !mediaUrl || imageError;
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
          <div className="flex items-center gap-2 mb-1.5">
            <span className="gov-badge-danger">
              <ShieldAlert className="w-3.5 h-3.5" /> {t('evidence.aiVerifiedBadge')}
            </span>
            <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">#{challan.id}</span>
          </div>
          <h2 className="text-xl font-extrabold text-[#172033] dark:text-[#F1F5F9]">
            {t('evidence.modalTitle', { id: challan.id })}
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
            {t('evidence.authenticityNote')}
          </p>
        </div>

        {/* Violation Meta Summary */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#F7F9FC] dark:bg-[#162238]/60 border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl text-xs mb-4">
          <div>
            <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('common.vehicleNumber')}</span>
            <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">{plate}</span>
          </div>
          <div>
            <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('common.violation')}</span>
            <span className="font-bold text-[#DC2626] dark:text-[#F87171] truncate block">
              {translateViolation(challan.violation)}
            </span>
          </div>
          <div>
            <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('common.dateTime')}</span>
            <span className="text-[#172033] dark:text-[#F1F5F9] font-medium">
              {formatDate(challan.violationDatetime, true)}
            </span>
          </div>
          <div>
            <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('common.fineAmount')}</span>
            <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
              {formatCurrency(Number(challan.fineAmount))}
            </span>
          </div>
        </div>

        {/* Evidence Visual Area */}
        <div className="mb-6">
          {!showFallback ? (
            <div className="rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F7F9FC] dark:bg-[#0D1524] flex items-center justify-center min-h-[220px]">
              <img
                src={mediaUrl}
                alt={`Violation Evidence for ${challan.id}`}
                className="w-full max-h-72 object-contain mx-auto rounded-lg shadow-sm"
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#F7F9FC] dark:bg-[#162238]/60 border border-[#E2E8F0] dark:border-[#1E293B] text-center text-[#64748B] dark:text-[#94A3B8] text-xs flex flex-col items-center justify-center gap-2 min-h-[200px]">
              <ImageOff className="w-8 h-8 text-[#94A3B8]" />
              <p className="font-bold text-[#172033] dark:text-[#F1F5F9] text-sm">
                {t('challanDetails.noEvidenceImg')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto btn-secondary text-xs py-2.5 px-5"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
