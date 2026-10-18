import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Car,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { Challan, Vehicle } from '../../types';
import { api } from '../../services/api';

export const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t, translateViolation, translateVehicleClass, formatCurrency, formatNumber } = useLanguage();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/citizen/login');
      return;
    }
    loadDashboardData();
  }, [user, navigate]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [vList, cList] = await Promise.all([
        api.getMyVehicles(),
        api.getMyChallans(),
      ]);
      setVehicles(vList);
      setChallans(cList);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const pendingChallans = challans.filter((c) => c.status !== 'paid');
  const paidChallans = challans.filter((c) => c.status === 'paid');
  const totalDueAmount = pendingChallans.reduce((sum, c) => sum + c.fineAmount, 0);

  return (
    <div className="min-h-[calc(100vh-140px)] bg-transparent py-8 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Owner Dashboard Header with Compact Language Selector */}
        <div className="gov-card p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#3B82F6] dark:text-[#38BDF8] bg-[#EFF6FF] dark:bg-[#3B82F6]/15 px-2.5 py-0.5 rounded-full border border-[#BFDBFE] dark:border-[#3B82F6]/30">
                {t('dashboard.portalBadge')}
              </span>
              <span className="text-xs text-[#CBD5E1] dark:text-[#334155]">•</span>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
                +91 {user?.mobileNumber ? `******${user.mobileNumber.slice(-4)}` : '******6011'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
              {t('dashboard.welcome', { name: user?.fullName || 'Citizen' })}
            </h1>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed max-w-2xl">
              {t('dashboard.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Compact 3-Language Selector in Owner Dashboard Header */}
            <LanguageSelector />

            <button
              type="button"
              onClick={loadDashboardData}
              disabled={loading}
              className="p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111C2E] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F5F7FB] dark:hover:bg-[#162238] hover:text-[#3B82F6] dark:hover:text-[#38BDF8] transition-colors shadow-sm"
              title="Refresh data"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3B82F6]' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: My Vehicles */}
          <div className="gov-card-interactive p-5 border-t-4 border-t-[#3B82F6]">
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                {t('nav.myVehicles')}
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] dark:bg-[#3B82F6]/15 border border-[#BFDBFE] dark:border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6] dark:text-[#38BDF8]">
                <Car className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#172033] dark:text-[#F1F5F9] font-mono">
              {loading ? '...' : formatNumber(vehicles.length)}
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{t('dashboard.registeredVehicles')}</p>
          </div>

          {/* Card 2: Total Challans */}
          <div className="gov-card-interactive p-5 border-t-4 border-t-[#06B6D4]">
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                {t('dashboard.totalChallansIssued')}
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#ECFEFF] dark:bg-[#06B6D4]/15 border border-[#A5F3FC] dark:border-[#06B6D4]/30 flex items-center justify-center text-[#06B6D4]">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#172033] dark:text-[#F1F5F9] font-mono">
              {loading ? '...' : formatNumber(challans.length)}
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{t('nav.myChallans')}</p>
          </div>

          {/* Card 3: Pending Challans */}
          <div className="gov-card-interactive p-5 border-t-4 border-t-[#F59E0B]">
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#D97706] dark:text-[#FBBF24]">
                {t('status.pending')}
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#FFFBEB] dark:bg-[#F59E0B]/15 border border-[#FDE68A] dark:border-[#F59E0B]/30 flex items-center justify-center text-[#D97706] dark:text-[#F59E0B]">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#D97706] dark:text-[#F59E0B] font-mono">
              {loading ? '...' : formatNumber(pendingChallans.length)}
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
              {t('dashboard.pendingAmount')}:{' '}
              <strong className="text-[#172033] dark:text-[#F1F5F9] font-mono">{formatCurrency(totalDueAmount)}</strong>
            </p>
          </div>

          {/* Card 4: Paid Challans */}
          <div className="gov-card-interactive p-5 border-t-4 border-t-[#10B981]">
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#16856B] dark:text-[#34D399]">
                {t('status.paid')}
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#A7F3D0] dark:border-[#10B981]/30 flex items-center justify-center text-[#16856B] dark:text-[#10B981]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#16856B] dark:text-[#34D399] font-mono">
              {loading ? '...' : formatNumber(paidChallans.length)}
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
              {t('dashboard.settledRecords', { count: formatNumber(paidChallans.length) })}
            </p>
          </div>
        </div>

        {/* 2 Main Action Sections: My Vehicles & My Challans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Section 1: My Vehicles Navigation */}
          <div className="gov-card p-6 flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] dark:bg-[#3B82F6]/15 text-[#3B82F6] dark:text-[#38BDF8] flex items-center justify-center mb-4 border border-[#BFDBFE] dark:border-[#3B82F6]/30">
                <Car className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-[#172033] dark:text-[#F1F5F9]">{t('dashboard.myVehiclesTitle')}</h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1.5 leading-relaxed">
                {t('vehicles.subtitle')}
              </p>

              {/* Quick preview of vehicles */}
              <div className="mt-4 space-y-2.5">
                {vehicles.length === 0 ? (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] italic py-2">{t('dashboard.noVehiclesPrompt')}</p>
                ) : (
                  vehicles.slice(0, 3).map((v) => {
                    const plate = v.plateNumber || '';
                    const vType = v.model || v.vehicleType || '2-Wheeler';
                    return (
                      <div
                        key={v.id || plate}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#F5F7FB] dark:bg-[#162238] border border-[#E2E8F0] dark:border-[#1E293B] text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">{plate}</span>
                          <span className="text-[#64748B] dark:text-[#94A3B8] ml-2">({translateVehicleClass(vType)})</span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16856B] dark:text-[#34D399] bg-[#ECFDF5] dark:bg-[#10B981]/15 px-2.5 py-0.5 rounded-full border border-[#A7F3D0] dark:border-[#10B981]/30">
                          <ShieldCheck className="w-3.5 h-3.5" /> {t('status.verified')}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-6">
              <Link to="/citizen/vehicles" className="w-full btn-secondary text-xs">
                {t('dashboard.manageVehicles')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Section 2: My Challans Navigation */}
          <div className="gov-card p-6 flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/15 text-[#D97706] dark:text-[#F59E0B] flex items-center justify-center mb-4 border border-[#FDE68A] dark:border-[#F59E0B]/30">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-[#172033] dark:text-[#F1F5F9]">{t('nav.myChallans')}</h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1.5 leading-relaxed">
                {t('challans.subtitle')}
              </p>

              {/* Quick preview of challans */}
              <div className="mt-4 space-y-2.5">
                {challans.length === 0 ? (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] italic py-2">{t('dashboard.noChallansDesc')}</p>
                ) : (
                  challans.slice(0, 3).map((c) => {
                    const isPaid = c.status === 'paid';
                    const plate = c.vehiclePlate || '';
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#F5F7FB] dark:bg-[#162238] border border-[#E2E8F0] dark:border-[#1E293B] text-xs gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-[#172033] dark:text-[#F1F5F9] truncate block sm:inline">
                            {translateViolation(c.violation)}
                          </span>
                          <span className="text-[#64748B] dark:text-[#94A3B8] font-mono sm:ml-2 block sm:inline">
                            • {plate}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                            {formatCurrency(c.fineAmount)}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              isPaid
                                ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#16856B] dark:text-[#34D399] border-[#A7F3D0] dark:border-[#10B981]/30'
                                : 'bg-[#FFFBEB] dark:bg-[#F59E0B]/15 text-[#D97706] dark:text-[#FBBF24] border-[#FDE68A] dark:border-[#F59E0B]/30'
                            }`}
                          >
                            {isPaid ? t('status.paid') : t('status.pending')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-6">
              <Link to="/citizen/challans" className="w-full btn-primary text-xs">
                {t('nav.myChallans')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
