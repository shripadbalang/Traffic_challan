import React from 'react';
import { Camera, MapPin, ShieldAlert } from 'lucide-react';
import { Challan } from '../../types';
import { Modal } from '../common/Modal';
import { useLanguage } from '../../context/LanguageContext';

interface EvidenceViewerProps {
  isOpen: boolean;
  onClose: () => void;
  challan: Challan | null;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({ isOpen, onClose, challan }) => {
  const { t, translateViolation, formatDate, formatCurrency } = useLanguage();

  if (!challan) return null;

  const hasPhoto = Boolean(challan.hasEvidence && challan.evidenceUrl);
  const plate = challan.vehiclePlate || '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-[#174EA6] dark:text-[#3B82F6]" />
          <span className="font-bold text-[#172033] dark:text-[#F1F5F9]">
            {t('evidence.modalTitle', { id: challan.id })}
          </span>
        </div>
      }
      maxWidth="3xl"
    >
      <div className="space-y-5 text-[#172033] dark:text-[#F1F5F9]">
        {/* Evidence Visual Display */}
        <div className="rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F7F9FC] dark:bg-[#0D1524] flex items-center justify-center min-h-[260px] select-none">
          {hasPhoto && challan.evidenceUrl ? (
            challan.evidenceType === 'video' ||
            challan.evidenceUrl.match(/\.(mp4|webm|avi|mov)$/i) ? (
              <video
                src={challan.evidenceUrl}
                controls
                autoPlay
                loop
                muted
                className="w-full max-h-[420px] object-contain bg-black"
              />
            ) : (
              <img
                src={challan.evidenceUrl}
                alt={`Violation evidence for challan ${challan.id}`}
                className="w-full max-h-[420px] object-contain"
              />
            )
          ) : (
            <div className="text-center p-8 max-w-md">
              <div className="w-14 h-14 rounded-full bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-center mx-auto mb-3 text-[#64748B] dark:text-[#94A3B8]">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-[#172033] dark:text-[#F1F5F9]">
                {t('challanDetails.noEvidenceImg')}
              </p>
            </div>
          )}
        </div>

        {/* Official Citation Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2.5 bg-[#F7F9FC] dark:bg-[#162238]/60 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B]">
            <h4 className="font-bold text-[#172033] dark:text-[#F1F5F9] flex items-center gap-2 pb-1.5 border-b border-[#E2E8F0] dark:border-[#1E293B]">
              <ShieldAlert className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24]" />
              <span>{t('challanDetails.vehicleAndViolation')}</span>
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">{t('common.violation')}:</span>
                <span className="font-semibold text-[#172033] dark:text-[#F1F5F9] text-right">
                  {translateViolation(challan.violation)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] dark:text-[#94A3B8]">{t('common.fineAmount')}:</span>
                <span className="font-bold font-mono text-[#172033] dark:text-[#F1F5F9] text-sm">
                  {formatCurrency(Number(challan.fineAmount))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B] dark:text-[#94A3B8]">{t('common.status')}:</span>
                <span
                  className={
                    challan.status === 'paid' ? 'gov-badge-success' : 'gov-badge-warning'
                  }
                >
                  {challan.status === 'paid' ? t('status.paid') : t('status.pending')}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 bg-[#F7F9FC] dark:bg-[#162238]/60 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B]">
            <h4 className="font-bold text-[#172033] dark:text-[#F1F5F9] flex items-center gap-2 pb-1.5 border-b border-[#E2E8F0] dark:border-[#1E293B]">
              <MapPin className="w-4 h-4 text-[#174EA6] dark:text-[#3B82F6]" />
              <span>{t('evidence.cameraFeed')}</span>
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Location:</span>
                <span className="text-[#172033] dark:text-[#F1F5F9] font-medium text-right max-w-[210px] truncate">
                  {challan.location || 'Traffic Division Zone'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] dark:text-[#94A3B8]">{t('common.dateTime')}:</span>
                <span className="text-[#172033] dark:text-[#F1F5F9] font-medium">
                  {formatDate(challan.violationDatetime, true)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B] dark:text-[#94A3B8]">{t('common.vehicleNumber')}:</span>
                <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9] bg-white dark:bg-[#0D1524] px-2 py-0.5 rounded border border-[#E2E8F0] dark:border-[#1E293B]">
                  {plate}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs py-2 px-5"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
