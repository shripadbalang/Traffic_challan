import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Download, CheckCircle2, Building2, X } from 'lucide-react';
import { Challan } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

interface QRReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: Challan | null;
}

export const QRReceiptModal: React.FC<QRReceiptModalProps> = ({ isOpen, onClose, challan }) => {
  const { user } = useAuth();
  const { t, translateViolation, formatDate, formatCurrency } = useLanguage();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && challan) {
      loadOfficialReceipt();
    }
  }, [isOpen, challan]);

  const loadOfficialReceipt = async () => {
    if (!challan) return;
    setLoading(true);
    try {
      const data = await api.getReceipt(challan.id);
      setReceiptData(data);
    } catch {
      const vDate = new Date(challan.violationDatetime);
      setReceiptData({
        receipt_number: `REC-MH-${String(challan.id).slice(0, 8).toUpperCase()}`,
        challan_id: challan.id,
        owner_name: user?.fullName || 'Vehicle Owner',
        vehicle_plate: challan.vehiclePlate,
        violation_name: challan.violation,
        violation_date: vDate.toISOString(),
        challan_amount: challan.fineAmount,
        amount_paid: challan.fineAmount,
        payment_date: new Date().toISOString(),
        transaction_id: challan.payment?.paymentId || `TXN_${Date.now().toString().slice(-10)}`,
        payment_status: 'PAID',
        verification_url: `${window.location.origin}/verify-receipt/${challan.id}`,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !challan) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (receiptData?.pdf_url) {
      window.open(receiptData.pdf_url, '_blank');
      return;
    }
    window.print();
  };

  const verifyUrl =
    receiptData?.verification_url || `${window.location.origin}/verify-receipt/${challan.id}`;
  const receiptNumber =
    receiptData?.receipt_number || `REC-MH-${String(challan.id).slice(0, 8).toUpperCase()}`;
  const ownerName = receiptData?.owner_name || user?.fullName || 'Vehicle Owner';
  const violationDate = formatDate(challan.violationDatetime);
  const paymentDate = formatDate(challan.paymentDate || new Date());
  const transactionId =
    receiptData?.transaction_id ||
    challan.payment?.paymentId ||
    `TXN_${String(challan.id).slice(0, 10).toUpperCase()}`;
  const plate = challan.vehiclePlate || '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto transition-all">
      <div className="bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl max-w-xl w-full p-6 shadow-2xl relative my-6 print:m-0 print:p-0 print:border-none print:shadow-none transition-colors">
        {/* Header Action Buttons (hidden on print) */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E2E8F0] dark:border-[#1E293B] print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#3B82F6] dark:text-[#38BDF8]" />
            <span className="font-bold text-[#172033] dark:text-[#F1F5F9] text-sm">{t('receipt.modalTitle')}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn-secondary py-1.5 px-3 text-xs"
              title={t('receipt.printReceipt')}
            >
              <Printer className="w-3.5 h-3.5" /> {t('receipt.printReceipt')}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] hover:bg-[#F5F7FB] dark:hover:bg-[#162238]"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= SINGLE-PAGE RECEIPT CARD ================= */}
        <div
          ref={receiptRef}
          className="bg-white dark:bg-[#162238] border-2 border-[#E2E8F0] dark:border-[#24344D] rounded-xl p-6 text-[#172033] dark:text-[#F1F5F9] font-sans print:border-none print:p-0 relative"
          style={{ pageBreakInside: 'avoid' }}
        >
          {/* Top Indian Tricolor Strip */}
          <div className="h-1.5 w-full flex rounded-t overflow-hidden mb-4">
            <div className="flex-1 bg-[#FF9933]" />
            <div className="flex-1 bg-white dark:bg-[#94A3B8]" />
            <div className="flex-1 bg-[#138808]" />
          </div>

          {/* Receipt Title */}
          <div className="text-center pb-4 border-b border-[#E2E8F0] dark:border-[#24344D] mb-4">
            <h1 className="text-base sm:text-lg font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
              {t('receipt.modalTitle')}
            </h1>
            <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              {t('receipt.govHeader')}
            </p>
            <div className="mt-2 gov-badge-success">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('receipt.paymentSuccess')}
            </div>
          </div>

          {/* Key Fields Grid */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs sm:text-sm pb-4 border-b border-[#E2E8F0] dark:border-[#24344D] mb-4">
            <div>
              <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('common.receipt')}</span>
              <strong className="font-mono text-[#172033] dark:text-[#F1F5F9] font-bold">{receiptNumber}</strong>
            </div>

            <div className="text-right">
              <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('common.challanId')}</span>
              <strong className="font-mono text-[#172033] dark:text-[#F1F5F9]">#{challan.id}</strong>
            </div>

            <div>
              <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('profile.fullName')}</span>
              <strong className="text-[#172033] dark:text-[#F1F5F9] font-semibold">{ownerName}</strong>
            </div>

            <div className="text-right">
              <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('common.vehicleNumber')}</span>
              <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">{plate}</span>
            </div>

            <div>
              <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('common.violation')}</span>
              <strong className="text-[#EF4444] font-semibold">
                {translateViolation(challan.violation)}
              </strong>
            </div>

            <div className="text-right">
              <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{t('common.date')}</span>
              <span className="text-[#172033] dark:text-[#F1F5F9]">{violationDate}</span>
            </div>
          </div>

          {/* Payment & Amount Details */}
          <div className="grid grid-cols-2 gap-y-2 text-xs sm:text-sm pb-4 border-b border-[#E2E8F0] dark:border-[#24344D] mb-4">
            <div className="flex justify-between col-span-2 text-[#64748B] dark:text-[#94A3B8]">
              <span>{t('common.fineAmount')}:</span>
              <span className="font-mono font-medium text-[#172033] dark:text-[#F1F5F9]">
                {formatCurrency(Number(challan.fineAmount))}
              </span>
            </div>

            <div className="flex justify-between col-span-2 text-[#172033] dark:text-[#F1F5F9] font-bold text-sm bg-[#ECFDF5] dark:bg-[#10B981]/15 p-2.5 rounded-lg border border-[#A7F3D0] dark:border-[#10B981]/30">
              <span>{t('receipt.amountPaid')}:</span>
              <span className="font-mono text-[#16856B] dark:text-[#34D399]">
                {formatCurrency(Number(challan.fineAmount))}
              </span>
            </div>

            <div className="flex justify-between col-span-2 text-xs text-[#64748B] dark:text-[#94A3B8] pt-1">
              <span>{t('receipt.paymentDate')}:</span>
              <span className="text-[#172033] dark:text-[#F1F5F9] font-medium">{paymentDate}</span>
            </div>

            <div className="flex justify-between col-span-2 text-xs text-[#64748B] dark:text-[#94A3B8] font-mono truncate">
              <span>{t('receipt.transactionId')}:</span>
              <span className="font-bold text-[#172033] dark:text-[#F1F5F9]">{transactionId}</span>
            </div>
          </div>

          {/* QR Code Verification Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
            <div className="text-center sm:text-left space-y-1">
              <span className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] block">
                {t('receipt.scanToVerify')}
              </span>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] max-w-xs leading-snug">
                {t('receipt.verifyHint')}
              </p>
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono mt-1">Ref: {receiptNumber}</p>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex-shrink-0">
              <QRCodeSVG value={verifyUrl} size={88} level="M" includeMargin={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
