import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CreditCard,
  QrCode,
  Building,
  CheckCircle2,
  ShieldCheck,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Challan } from '../../types';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: Challan | null;
  onPaymentSuccess: (paidChallan: Challan) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  challan,
  onPaymentSuccess,
}) => {
  const { t, translateViolation, formatCurrency } = useLanguage();
  const [tab, setTab] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('bank@okhdfcbank');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!challan) return null;

  const handlePay = async () => {
    setError(null);
    setProcessing(true);
    try {
      const initRes = await api.initiatePayment(challan.id);
      await new Promise((r) => setTimeout(r, 900));
      const txnId = `PAY_TXN_${Date.now().toString().slice(-8)}`;
      await api.verifyPayment(challan.id, initRes.orderId, txnId);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setProcessing(false);
        onPaymentSuccess({
          ...challan,
          status: 'paid',
          paymentDate: new Date().toISOString(),
          payment: {
            paymentId: txnId,
            amount: challan.fineAmount,
            paidAt: new Date().toISOString(),
            method:
              tab === 'upi'
                ? `UPI (${upiId})`
                : tab === 'card'
                ? 'Debit/Credit Card'
                : 'Net Banking (State Bank of India)',
          },
        });
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Payment processing failed. Please retry.');
      setProcessing(false);
    }
  };

  const upiIntentString = `upi://pay?pa=mahatraffic.police@sbi&pn=MaharashtraTrafficPolice&am=${challan.fineAmount}&cu=INR&tn=Challan_${challan.id}`;
  const plate = challan.vehiclePlate || '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#16856B] dark:text-[#34D399]" />
          <span className="font-bold text-[#172033] dark:text-[#F1F5F9]">{t('payment.modalTitle')}</span>
        </div>
      }
      maxWidth="md"
    >
      <div className="space-y-5 text-[#172033] dark:text-[#F1F5F9]">
        {/* Fine Summary Box */}
        <div className="p-4 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono block">
              {t('common.challanId')}: #{challan.id}
            </span>
            <span className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9] block mt-0.5 truncate">
              {translateViolation(challan.violation)}
            </span>
            <span className="inline-block mt-1 text-xs font-mono font-bold text-[#172033] dark:text-[#F1F5F9] bg-white dark:bg-[#0D1524] px-2 py-0.5 rounded border border-[#E2E8F0] dark:border-[#1E293B]">
              {plate}
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8] block">{t('payment.totalPayable')}</span>
            <span className="text-xl font-extrabold font-mono text-[#174EA6] dark:text-[#60A5FA]">
              {formatCurrency(Number(challan.fineAmount))}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 rounded-xl text-[#DC2626] dark:text-[#F87171] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] text-xs">
          <button
            type="button"
            onClick={() => setTab('upi')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold transition ${
              tab === 'upi'
                ? 'bg-[#174EA6] dark:bg-[#3B82F6] text-white shadow-sm'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> UPI / QR
          </button>
          <button
            type="button"
            onClick={() => setTab('card')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold transition ${
              tab === 'card'
                ? 'bg-[#174EA6] dark:bg-[#3B82F6] text-white shadow-sm'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> Card
          </button>
          <button
            type="button"
            onClick={() => setTab('netbanking')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold transition ${
              tab === 'netbanking'
                ? 'bg-[#174EA6] dark:bg-[#3B82F6] text-white shadow-sm'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
            }`}
          >
            <Building className="w-3.5 h-3.5" /> NetBanking
          </button>
        </div>

        {/* Tab 1: UPI */}
        {tab === 'upi' && (
          <div className="space-y-4 text-center">
            {/* White card container explicitly preserved in dark mode for QR code scanning */}
            <div className="inline-block p-4 bg-white rounded-xl border border-[#E2E8F0] dark:border-white/20 shadow-md">
              <QRCodeSVG value={upiIntentString} size={150} level="M" />
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{t('payment.method.upi')}</p>
            <div className="text-left">
              <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1.5">
                {t('payment.upiIdLabel')}
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder={t('payment.upiPlaceholder')}
                className="gov-input font-mono text-xs"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Debit/Credit Card */}
        {tab === 'card' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1">
                {t('payment.cardNumberLabel')}
              </label>
              <input
                type="text"
                maxLength={19}
                defaultValue="4532 •••• •••• 9012"
                className="gov-input font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1">
                  {t('payment.cardExpiryLabel')}
                </label>
                <input
                  type="text"
                  maxLength={5}
                  defaultValue="08/29"
                  className="gov-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1">
                  {t('payment.cardCvvLabel')}
                </label>
                <input
                  type="password"
                  maxLength={3}
                  defaultValue="•••"
                  className="gov-input font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Net Banking */}
        {tab === 'netbanking' && (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9]">
              {t('payment.selectBankLabel')}
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Bank of Maharashtra'].map(
                (bank, i) => (
                  <button
                    key={bank}
                    type="button"
                    className={`p-2.5 rounded-lg border text-left font-semibold transition ${
                      i === 0
                        ? 'border-[#174EA6] dark:border-[#3B82F6] bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA]'
                        : 'border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#CBD5E1] dark:hover:border-[#334155] bg-white dark:bg-[#162238] text-[#172033] dark:text-[#F1F5F9]'
                    }`}
                  >
                    {bank}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E293B]">
          <button
            type="button"
            onClick={handlePay}
            disabled={processing || success}
            className="w-full btn-success py-3 text-sm"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {t('payment.processingTitle')}
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> {t('payment.successTitle')}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />{' '}
                {t('payment.proceedToPay', {
                  amount: formatCurrency(Number(challan.fineAmount)),
                })}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            <Lock className="w-3 h-3 text-[#16856B] dark:text-[#34D399]" />
            <span>{t('payment.secureGateway')}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
