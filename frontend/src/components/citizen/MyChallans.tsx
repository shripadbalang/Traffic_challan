import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Eye,
  CreditCard,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { Challan, Vehicle } from '../../types';
import { api } from '../../services/api';
import { ChallanDetailsModal } from './ChallanDetailsModal';
import { EvidenceModal } from './EvidenceModal';
import { PaymentModal } from './PaymentModal';
import { QRReceiptModal } from '../common/QRReceiptModal';

export const MyChallans: React.FC = () => {
  const { user } = useAuth();
  const { t, translateViolation, translateVehicleClass, formatDate, formatCurrency, formatNumber } =
    useLanguage();
  const navigate = useNavigate();

  const [challans, setChallans] = useState<Challan[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'paid'>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState<string>('ALL');

  // Modal states
  const [detailsChallan, setDetailsChallan] = useState<Challan | null>(null);
  const [evidenceChallan, setEvidenceChallan] = useState<Challan | null>(null);
  const [payChallan, setPayChallan] = useState<Challan | null>(null);
  const [receiptChallan, setReceiptChallan] = useState<Challan | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/citizen/login');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cList, vList] = await Promise.all([
        api.getMyChallans(),
        api.getMyVehicles(),
      ]);
      setChallans(cList);
      setVehicles(vList);
    } catch (err) {
      console.error('Failed to load challans:', err);
    } finally {
      setLoading(false);
    }
  };

  const isChallanPending = (c: Challan) => c.status !== 'paid';

  // Filtered list
  const filteredChallans = challans.filter((c) => {
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'pending'
        ? isChallanPending(c)
        : c.status === 'paid';

    const plate = (c.vehiclePlate || '').toUpperCase();
    const matchesVehicle =
      vehicleFilter === 'ALL' || plate === vehicleFilter.toUpperCase();

    return matchesStatus && matchesVehicle;
  });

  const unpaidCount = challans.filter(isChallanPending).length;
  const paidCount = challans.filter((c) => c.status === 'paid').length;

  const handlePaymentSuccess = (updatedChallan: Challan) => {
    setChallans((prev) => prev.map((c) => (c.id === updatedChallan.id ? updatedChallan : c)));
    setPayChallan(null);
    setReceiptChallan(updatedChallan);
    loadData();
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-transparent py-8 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="gov-card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
              {t('challans.title')}
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
              {t('challans.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <LanguageSelector />
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111C2E] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F5F7FB] dark:hover:bg-[#162238] hover:text-[#3B82F6] dark:hover:text-[#38BDF8] transition-colors shadow-sm"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3B82F6]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="gov-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F5F7FB] dark:bg-[#0B1220] border border-[#E2E8F0] dark:border-[#1E293B] rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-md transition ${
                statusFilter === 'ALL'
                  ? 'bg-[#3B82F6] text-white shadow-sm font-bold'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
              }`}
            >
              {t('challans.filterAll')} ({formatNumber(challans.length)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3.5 py-1.5 rounded-md transition ${
                statusFilter === 'pending'
                  ? 'bg-[#F59E0B] text-white shadow-sm font-bold'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
              }`}
            >
              {t('status.pending')} ({formatNumber(unpaidCount)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3.5 py-1.5 rounded-md transition ${
                statusFilter === 'paid'
                  ? 'bg-[#10B981] text-white shadow-sm font-bold'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
              }`}
            >
              {t('status.paid')} ({formatNumber(paidCount)})
            </button>
          </div>

          {/* Vehicle Dropdown Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#64748B] dark:text-[#94A3B8] font-semibold whitespace-nowrap">
              {t('challans.filterByVehicle')}:
            </span>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-[#0D1524] border border-[#CBD5E1] dark:border-[#24344D] rounded-lg text-[#172033] dark:text-[#F1F5F9] font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6]"
            >
              <option value="ALL">
                {t('common.allVehicles')} ({formatNumber(vehicles.length)})
              </option>
              {vehicles.map((v) => {
                const plate = v.plateNumber || '';
                return (
                  <option key={v.id || plate} value={plate}>
                    {plate} ({translateVehicleClass(v.model || v.vehicleType)})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Challans Table */}
        {loading ? (
          <div className="gov-card py-16 text-center text-[#64748B] dark:text-[#94A3B8]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3B82F6]" />
            <p className="text-xs font-semibold">{t('common.loading')}</p>
          </div>
        ) : filteredChallans.length === 0 ? (
          <div className="gov-card p-12 text-center">
            <FileText className="w-12 h-12 text-[#94A3B8] dark:text-[#64748B] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#172033] dark:text-[#F1F5F9]">{t('challans.noMatchingTitle')}</h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-sm mx-auto mt-1">
              {t('challans.noMatchingDesc')}
            </p>
            {(statusFilter !== 'ALL' || vehicleFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setVehicleFilter('ALL');
                }}
                className="mt-4 btn-secondary text-xs py-2 px-4"
              >
                {t('challans.resetFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="gov-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F5F7FB] dark:bg-[#0B1220] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase text-[11px] tracking-wider">
                    <th className="py-3.5 px-4">{t('common.challanId')}</th>
                    <th className="py-3.5 px-4">{t('common.vehicleNumber')}</th>
                    <th className="py-3.5 px-4">{t('common.violation')}</th>
                    <th className="py-3.5 px-4">{t('common.date')}</th>
                    <th className="py-3.5 px-4 text-right">{t('common.fineAmount')}</th>
                    <th className="py-3.5 px-4 text-center">{t('common.status')}</th>
                    <th className="py-3.5 px-4 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
                  {filteredChallans.map((c) => {
                    const isPaid = c.status === 'paid';
                    const plate = c.vehiclePlate || '';

                    return (
                      <tr key={c.id} className="hover:bg-[#F5F7FB] dark:hover:bg-[#162238] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                          #{c.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9] bg-[#F5F7FB] dark:bg-[#162238] px-2 py-0.5 rounded border border-[#E2E8F0] dark:border-[#24344D]">
                            {plate}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#172033] dark:text-[#F1F5F9]">
                          {translateViolation(c.violation)}
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B] dark:text-[#94A3B8] text-xs whitespace-nowrap">
                          {formatDate(c.violationDatetime)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                          {formatCurrency(Number(c.fineAmount))}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={
                              isPaid ? 'gov-badge-success' : 'gov-badge-warning'
                            }
                          >
                            {isPaid ? t('status.paid') : t('status.pending')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailsChallan(c)}
                              className="px-2.5 py-1.5 bg-white dark:bg-[#111C2E] hover:bg-[#F5F7FB] dark:hover:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] rounded-lg text-xs font-semibold border border-[#E2E8F0] dark:border-[#1E293B] transition"
                              title={t('common.details')}
                            >
                              {t('common.details')}
                            </button>

                            <button
                              type="button"
                              onClick={() => setEvidenceChallan(c)}
                              className="px-2.5 py-1.5 bg-white dark:bg-[#111C2E] hover:bg-[#F5F7FB] dark:hover:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] rounded-lg text-xs font-semibold border border-[#E2E8F0] dark:border-[#1E293B] transition flex items-center gap-1"
                              title={t('common.evidence')}
                            >
                              <Eye className="w-3.5 h-3.5 text-[#3B82F6] dark:text-[#38BDF8]" /> {t('common.evidence')}
                            </button>

                            {isPaid ? (
                              <button
                                type="button"
                                onClick={() => setReceiptChallan(c)}
                                className="px-3 py-1.5 bg-[#ECFDF5] dark:bg-[#10B981]/15 hover:bg-[#D1FAE5] dark:hover:bg-[#10B981]/25 text-[#16856B] dark:text-[#34D399] rounded-lg text-xs font-bold border border-[#A7F3D0] dark:border-[#10B981]/30 transition flex items-center gap-1"
                              >
                                <FileCheck2 className="w-3.5 h-3.5" /> {t('common.viewReceipt')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPayChallan(c)}
                                className="px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                              >
                                <CreditCard className="w-3.5 h-3.5" /> {t('common.payNow')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ChallanDetailsModal
        challan={detailsChallan}
        onClose={() => setDetailsChallan(null)}
        onPay={(c) => {
          setDetailsChallan(null);
          setPayChallan(c);
        }}
        onViewReceipt={(c) => {
          setDetailsChallan(null);
          setReceiptChallan(c);
        }}
      />

      <EvidenceModal
        challan={evidenceChallan}
        onClose={() => setEvidenceChallan(null)}
      />

      <PaymentModal
        isOpen={!!payChallan}
        challan={payChallan}
        onClose={() => setPayChallan(null)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <QRReceiptModal
        isOpen={!!receiptChallan}
        challan={receiptChallan}
        onClose={() => setReceiptChallan(null)}
      />
    </div>
  );
};
