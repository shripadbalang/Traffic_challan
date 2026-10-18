import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car,
  Plus,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { Vehicle } from '../../types';
import { api } from '../../services/api';

export const MyVehicles: React.FC = () => {
  const { user } = useAuth();
  const { t, translateVehicleClass, formatCurrency, formatNumber } = useLanguage();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Vehicle Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPlate, setAddPlate] = useState('');
  const [addMobile, setAddMobile] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Remove Vehicle Modal State
  const [vehicleToRemove, setVehicleToRemove] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // View Details Modal State
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/citizen/login');
      return;
    }
    loadVehicles();
  }, [user, navigate]);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const data = await api.getMyVehicles();
      setVehicles(data);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Add Vehicle Submission
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);

    const cleanPlate = addPlate.trim().toUpperCase();
    const cleanMob = addMobile.replace(/\D/g, '');

    if (!cleanPlate) {
      setAddError(t('vehicles.errorInvalidPlate'));
      return;
    }
    if (cleanMob.length !== 10) {
      setAddError('Please enter a valid 10-digit registered mobile number.');
      return;
    }

    setAddLoading(true);
    try {
      const res = await api.addVehicle(cleanPlate, cleanMob);
      setAddSuccess(`Vehicle ${res.plate_number} has been verified and linked successfully!`);
      setAddPlate('');
      setAddMobile('');
      await loadVehicles();
      setTimeout(() => {
        setShowAddModal(false);
        setAddSuccess(null);
      }, 1500);
    } catch (err: any) {
      setAddError(
        err.message || 'The vehicle number and registered mobile number do not match our records.'
      );
    } finally {
      setAddLoading(false);
    }
  };

  // Handle View Details Modal Trigger
  const handleViewDetails = async (plateNumber: string) => {
    try {
      const summary = await api.lookupVehicleSummary(plateNumber);
      setSelectedVehicle(summary);
    } catch {
      const fallback = vehicles.find((v) => v.plateNumber === plateNumber);
      setSelectedVehicle({
        plate_number: plateNumber,
        vehicle_type: fallback?.vehicleType || '2-Wheeler',
        model: fallback?.model || 'Standard',
        pending_challans: 0,
        total_challan_amount: 0,
      });
    }
  };

  // Handle Confirm Remove Vehicle
  const handleConfirmRemoveVehicle = async () => {
    if (!vehicleToRemove) return;
    setRemoveLoading(true);
    setRemoveError(null);
    try {
      await api.removeVehicle(vehicleToRemove);
      const removedPlate = vehicleToRemove;
      setVehicles((prev) => prev.filter((v) => v.plateNumber !== removedPlate));
      setVehicleToRemove(null);
      setSuccessBanner(`Vehicle ${removedPlate} removed from your account.`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: any) {
      setRemoveError(err.message || 'Failed to remove vehicle.');
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-transparent py-8 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="gov-card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
              {t('vehicles.title')}
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
              {t('vehicles.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <LanguageSelector />
            <button
              type="button"
              onClick={loadVehicles}
              disabled={loading}
              className="p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111C2E] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F5F7FB] dark:hover:bg-[#162238] hover:text-[#3B82F6] dark:hover:text-[#38BDF8] transition-colors shadow-sm"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3B82F6]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setAddError(null);
                setAddSuccess(null);
              }}
              className="btn-primary text-xs"
            >
              <Plus className="w-4 h-4" /> {t('vehicles.addVehicle')}
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successBanner && (
          <div className="p-3.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#A7F3D0] dark:border-[#10B981]/30 text-[#16856B] dark:text-[#34D399] text-xs flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#10B981] flex-shrink-0" />
              <span className="font-semibold">{successBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-[#16856B] dark:text-[#34D399] hover:opacity-80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Vehicles Grid / List */}
        {loading ? (
          <div className="gov-card py-16 text-center text-[#64748B] dark:text-[#94A3B8]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3B82F6]" />
            <p className="text-xs font-semibold">{t('common.loading')}</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="gov-card border-2 border-dashed border-[#CBD5E1] dark:border-[#24344D] p-12 text-center">
            <Car className="w-12 h-12 text-[#94A3B8] dark:text-[#64748B] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#172033] dark:text-[#F1F5F9]">{t('vehicles.noVehiclesTitle')}</h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto mt-1 mb-5 leading-relaxed">
              {t('vehicles.noVehiclesDesc')}
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="btn-primary text-xs"
            >
              <Plus className="w-4 h-4" /> {t('vehicles.addVehicle')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {vehicles.map((v) => {
              const plate = v.plateNumber || '';
              return (
                <div
                  key={v.id || plate}
                  className="gov-card-interactive p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Plate Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#1E293B]">
                      <span className="font-mono text-lg font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-wider bg-[#F5F7FB] dark:bg-[#162238] px-2.5 py-1 rounded-md border border-[#E2E8F0] dark:border-[#24344D]">
                        {plate}
                      </span>
                      <span className="gov-badge-success">
                        <ShieldCheck className="w-3.5 h-3.5" /> {t('status.verified')}
                      </span>
                    </div>

                    {/* Vehicle Meta */}
                    <div className="py-4 space-y-2.5 text-xs">
                      <div className="flex justify-between text-[#64748B] dark:text-[#94A3B8]">
                        <span>{t('common.vehicleClass')}:</span>
                        <strong className="text-[#172033] dark:text-[#F1F5F9] text-right">
                          {translateVehicleClass(v.vehicleType)}
                        </strong>
                      </div>
                      <div className="flex justify-between text-[#64748B] dark:text-[#94A3B8]">
                        <span>Model:</span>
                        <span className="text-[#172033] dark:text-[#F1F5F9] font-medium">{v.model || 'Standard'}</span>
                      </div>
                      <div className="flex justify-between text-[#64748B] dark:text-[#94A3B8]">
                        <span>RTO:</span>
                        <span className="text-[#172033] dark:text-[#F1F5F9] font-mono font-semibold">
                          {v.rtoCode || plate.substring(0, 4)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewDetails(plate)}
                      className="flex-1 btn-secondary py-2 px-3 text-xs"
                    >
                      {t('vehicles.viewDetails')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleToRemove(plate);
                        setRemoveError(null);
                      }}
                      className="py-2 px-3 bg-[#FEF2F2] dark:bg-[#EF4444]/10 hover:bg-[#FEE2E2] dark:hover:bg-[#EF4444]/20 text-[#DC2626] dark:text-[#F87171] rounded-lg text-xs font-semibold transition border border-[#FECACA] dark:border-[#EF4444]/30 flex items-center gap-1.5"
                      title={`${t('vehicles.remove')} ${plate}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t('vehicles.remove')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= ADD VEHICLE MODAL ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4 transition-all">
          <div className="bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] hover:bg-[#F5F7FB] dark:hover:bg-[#162238]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-bold text-[#172033] dark:text-[#F1F5F9]">{t('vehicles.modalAddTitle')}</h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
                {t('vehicles.modalAddSubtitle')}
              </p>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-lg bg-[#FEF2F2] dark:bg-[#EF4444]/10 border border-[#FECACA] dark:border-[#EF4444]/30 text-[#DC2626] dark:text-[#F87171] text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#EF4444] flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{addError}</p>
              </div>
            )}

            {addSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#A7F3D0] dark:border-[#10B981]/30 text-[#16856B] dark:text-[#34D399] text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#10B981] flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{addSuccess}</p>
              </div>
            )}

            <form onSubmit={handleAddVehicle} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1.5">
                  {t('common.vehicleNumber')} <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addPlate}
                  onChange={(e) => setAddPlate(e.target.value.toUpperCase())}
                  placeholder={t('vehicles.vehicleNumPlaceholder')}
                  className="gov-input font-mono uppercase"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1.5">
                  {t('auth.phoneLabel')} <span className="text-[#DC2626]">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3.5 rounded-l-lg border border-r-0 border-[#CBD5E1] dark:border-[#24344D] bg-[#F5F7FB] dark:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] font-semibold text-xs">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={addMobile}
                    onChange={(e) => setAddMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder={t('auth.phonePlaceholder')}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0D1524] border border-[#CBD5E1] dark:border-[#24344D] rounded-r-lg text-[#172033] dark:text-[#F1F5F9] placeholder-[#64748B] dark:placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6] text-sm font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="w-full btn-primary py-3 text-xs"
                >
                  {addLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> {t('vehicles.linking')}
                    </>
                  ) : (
                    t('vehicles.confirmLink')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= VIEW DETAILS MODAL ================= */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4 transition-all">
          <div className="bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedVehicle(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] hover:bg-[#F5F7FB] dark:hover:bg-[#162238]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="gov-badge-info">
                {t('vehicles.rtoVerified')}
              </span>
              <h2 className="text-xl font-extrabold text-[#172033] dark:text-[#F1F5F9] mt-2">
                {t('vehicles.modalDetailsTitle')}
              </h2>
            </div>

            <div className="border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-xs sm:text-sm bg-[#F5F7FB] dark:bg-[#162238]">
              <div className="p-3.5 flex justify-between items-center">
                <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('common.vehicleNumber')}</span>
                <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                  {selectedVehicle.plate_number}
                </span>
              </div>
              <div className="p-3.5 flex justify-between items-center">
                <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('common.vehicleClass')}</span>
                <span className="font-semibold text-[#172033] dark:text-[#F1F5F9]">
                  {translateVehicleClass(selectedVehicle.vehicle_type)}
                </span>
              </div>
              <div className="p-3.5 flex justify-between items-center">
                <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">Model</span>
                <span className="font-medium text-[#172033] dark:text-[#F1F5F9]">
                  {selectedVehicle.model || 'Standard'}
                </span>
              </div>
              <div className="p-3.5 flex justify-between items-center">
                <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('common.status')}</span>
                <span className="gov-badge-success">
                  <ShieldCheck className="w-3.5 h-3.5" /> {t('status.verified')}
                </span>
              </div>
              <div className="p-3.5 flex justify-between items-center">
                <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('status.pending')}</span>
                <span
                  className={`font-bold font-mono ${
                    selectedVehicle.pending_challans > 0 ? 'text-[#D97706] dark:text-[#F59E0B]' : 'text-[#16856B] dark:text-[#34D399]'
                  }`}
                >
                  {formatNumber(selectedVehicle.pending_challans || 0)}
                </span>
              </div>
              <div className="p-3.5 flex justify-between items-center">
                <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{t('common.fineAmount')}</span>
                <span className="font-bold font-mono text-[#172033] dark:text-[#F1F5F9]">
                  {formatCurrency(Number(selectedVehicle.total_challan_amount || 0))}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedVehicle(null);
                  navigate('/citizen/challans');
                }}
                className="w-full btn-primary text-xs"
              >
                <FileText className="w-4 h-4" /> {t('nav.myChallans')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= REMOVE VEHICLE CONFIRMATION MODAL ================= */}
      {vehicleToRemove && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4 transition-all">
          <div className="bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => {
                setVehicleToRemove(null);
                setRemoveError(null);
              }}
              disabled={removeLoading}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] hover:bg-[#F5F7FB] dark:hover:bg-[#162238]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <h2 className="text-lg font-bold text-[#172033] dark:text-[#F1F5F9]">{t('vehicles.modalRemoveTitle')}</h2>
              <p className="text-xs text-[#172033] dark:text-[#F1F5F9] mt-2 font-medium leading-relaxed">
                {t('vehicles.modalRemoveConfirm', { plate: vehicleToRemove })}
              </p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1.5 leading-relaxed">
                {t('vehicles.modalRemoveNote')}
              </p>
            </div>

            {removeError && (
              <div className="mb-4 p-3 rounded-lg bg-[#FEF2F2] dark:bg-[#EF4444]/10 border border-[#FECACA] dark:border-[#EF4444]/30 text-[#DC2626] dark:text-[#F87171] text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#EF4444] flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{removeError}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setVehicleToRemove(null);
                  setRemoveError(null);
                }}
                disabled={removeLoading}
                className="btn-secondary text-xs py-2 px-4"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveVehicle}
                disabled={removeLoading}
                className="btn-danger text-xs py-2 px-4"
              >
                {removeLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t('vehicles.removing')}
                  </>
                ) : (
                  t('vehicles.confirmRemove')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
