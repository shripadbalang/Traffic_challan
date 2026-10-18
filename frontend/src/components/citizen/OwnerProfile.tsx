import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User as UserIcon,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  Edit2,
  X,
  RefreshCw,
  Car,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { api } from '../../services/api';

export const OwnerProfile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t, formatDate, formatNumber } = useLanguage();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState<{
    id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
    role: string;
    isVerified: boolean;
    createdAt?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Contact change modal state
  const [contactModalType, setContactModalType] = useState<'mobile' | 'email' | null>(null);
  const [newContactValue, setNewContactValue] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Linked vehicles count
  const [vehiclesCount, setVehiclesCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/citizen/login');
      return;
    }
    loadProfile();
  }, [user, navigate]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const loadProfile = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.getUserProfile();
      setProfileData({
        id: data.id,
        fullName: data.full_name,
        email: data.email,
        mobileNumber: data.mobile_number,
        role: data.role,
        isVerified: data.is_verified,
        createdAt: data.created_at,
      });
      setNameInput(data.full_name);

      try {
        const vehicles = await api.getMyVehicles();
        setVehiclesCount(vehicles.length);
      } catch {
        // vehicle fetch failsafe
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load profile details.');
      if (user) {
        setProfileData({
          id: String(user.id),
          fullName: user.fullName,
          email: user.email,
          mobileNumber: user.mobileNumber || '',
          role: user.role,
          isVerified: user.isVerified ?? true,
          createdAt: user.createdAt,
        });
        setNameInput(user.fullName);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      setErrorMsg('Full name cannot be blank.');
      return;
    }
    setSavingName(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const updated = await api.updateUserProfile({ fullName: nameInput.trim() });
      setProfileData((prev) => (prev ? { ...prev, fullName: updated.full_name } : null));
      updateUser({ fullName: updated.full_name });
      setIsEditingName(false);
      setSuccessMsg(t('profile.nameUpdated'));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleOpenContactModal = (type: 'mobile' | 'email') => {
    setContactModalType(type);
    setNewContactValue('');
    setOtpStep(false);
    setOtpInput('');
    setModalError('');
    setModalSuccess('');
    setResendCooldown(0);
  };

  const handleCloseContactModal = () => {
    setContactModalType(null);
    setNewContactValue('');
    setOtpStep(false);
    setOtpInput('');
    setModalError('');
    setModalSuccess('');
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (contactModalType === 'mobile') {
      const cleanMob = newContactValue.replace(/\D/g, '');
      if (cleanMob.length !== 10) {
        setModalError('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
    } else {
      if (!newContactValue.includes('@') || !newContactValue.includes('.')) {
        setModalError('Please enter a valid email address.');
        return;
      }
    }

    setModalLoading(true);
    try {
      const res = await api.requestContactOtp(newContactValue.trim());
      setModalSuccess(res.message || 'OTP sent successfully.');
      setOtpStep(true);
      setResendCooldown(60);
    } catch (err: any) {
      setModalError(err.message || 'Failed to request OTP code.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleVerifyAndUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (!otpInput.trim() || otpInput.trim().length !== 6) {
      setModalError('Please enter the 6-digit OTP code.');
      return;
    }

    setModalLoading(true);
    try {
      const payload: any = { otpCode: otpInput.trim() };
      if (contactModalType === 'mobile') {
        payload.mobileNumber = newContactValue.trim();
      } else {
        payload.email = newContactValue.trim();
      }

      const updated = await api.updateUserProfile(payload);
      setProfileData((prev) =>
        prev
          ? {
              ...prev,
              mobileNumber: updated.mobile_number,
              email: updated.email,
            }
          : null
      );

      updateUser({
        mobileNumber: updated.mobile_number,
        email: updated.email,
      });

      handleCloseContactModal();
      setSuccessMsg(t('profile.contactUpdated'));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setModalError(err.message || 'Verification failed. Please check the OTP and try again.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-transparent py-8 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Breadcrumb & Title */}
        <div className="gov-card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
              <Link to="/citizen/dashboard" className="hover:text-[#174EA6] dark:hover:text-[#3B82F6] transition">
                {t('nav.dashboard')}
              </Link>
              <span>/</span>
              <span className="text-[#172033] dark:text-[#F1F5F9]">{t('nav.profile')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
              {t('profile.title')}
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
              {t('profile.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <LanguageSelector />
            <button
              type="button"
              onClick={loadProfile}
              disabled={loading}
              className="p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111C2E] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F7F9FC] dark:hover:bg-[#162238] hover:text-[#174EA6] dark:hover:text-[#3B82F6] transition-colors shadow-sm"
              title="Refresh profile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#174EA6] dark:text-[#3B82F6]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="p-4 bg-[#ECFDF5] dark:bg-[#064E3B]/30 border border-[#A7F3D0] dark:border-[#059669]/40 rounded-xl flex items-center gap-3 text-[#16856B] dark:text-[#34D399] text-xs sm:text-sm shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 rounded-xl flex items-center gap-3 text-[#DC2626] dark:text-[#F87171] text-xs sm:text-sm shadow-sm">
            <AlertCircle className="w-5 h-5 text-[#DC2626] dark:text-[#F87171] flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Profile Card Summary */}
        <div className="gov-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-[#E2E8F0] dark:border-[#1E293B]">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#174EA6] dark:bg-[#3B82F6] text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                {profileData?.fullName ? profileData.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-[#172033] dark:text-[#F1F5F9]">
                    {profileData?.fullName || user?.fullName}
                  </h2>
                  <span className="gov-badge-success">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {t('profile.verifiedCitizen')}
                  </span>
                </div>
                <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                    {profileData?.createdAt ? formatDate(profileData.createdAt) : t('status.active')}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right w-full sm:w-auto p-3 sm:p-0 bg-[#F7F9FC] dark:bg-[#162238] sm:bg-transparent dark:sm:bg-transparent rounded-lg sm:rounded-none border border-[#E2E8F0] dark:border-[#1E293B] sm:border-0">
              <div className="text-[11px] uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] font-semibold">
                {t('profile.accountId')}
              </div>
              <div className="font-mono text-xs text-[#172033] dark:text-[#F1F5F9] font-bold mt-0.5 truncate max-w-[200px]">
                {profileData?.id || user?.id || 'OWNER-ACC'}
              </div>
            </div>
          </div>

          {/* Account Details Form / List */}
          <div className="mt-6 space-y-5">
            <h3 className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-[#174EA6] dark:text-[#3B82F6]" />
              {t('profile.personalInfo')}
            </h3>

            {/* Field: Full Name */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#F7F9FC] dark:bg-[#162238]/60 border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl gap-4">
              <div className="flex-1">
                <div className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{t('profile.fullName')}</div>
                {isEditingName ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="gov-input max-w-xs py-1.5"
                      placeholder={t('profile.fullName')}
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="btn-primary py-1.5 px-3 text-xs"
                    >
                      {savingName ? t('common.loading') : t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(false);
                        setNameInput(profileData?.fullName || '');
                      }}
                      className="btn-secondary py-1.5 px-3 text-xs"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9] mt-0.5">
                    {profileData?.fullName || t('profile.notLinked')}
                  </div>
                )}
              </div>
              {!isEditingName && (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#174EA6] dark:text-[#3B82F6]" />
                  {t('profile.editName')}
                </button>
              )}
            </div>

            {/* Field: Mobile Number */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#F7F9FC] dark:bg-[#162238]/60 border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#174EA6] dark:text-[#3B82F6]" />
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    {t('profile.mobileNumber')}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9] font-mono mt-0.5">
                  {profileData?.mobileNumber
                    ? `+91 ${profileData.mobileNumber}`
                    : t('profile.notLinked')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenContactModal('mobile')}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                {t('profile.changePhone')}
              </button>
            </div>

            {/* Field: Email Address */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#F7F9FC] dark:bg-[#162238]/60 border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#174EA6] dark:text-[#3B82F6]" />
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    {t('profile.emailAddress')}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9] mt-0.5">
                  {profileData?.email || t('profile.notLinked')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenContactModal('email')}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                {t('profile.changeEmail')}
              </button>
            </div>
          </div>

          {/* Data Protection & Governance Notice */}
          <div className="mt-8 pt-6 border-t border-[#E2E8F0] dark:border-[#1E293B] flex items-start gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <Lock className="w-4 h-4 text-[#174EA6] dark:text-[#3B82F6] flex-shrink-0 mt-0.5" />
            <div>{t('profile.securityNote')}</div>
          </div>
        </div>

        {/* Quick Link to My Vehicles & My Challans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/citizen/vehicles"
            className="gov-card-interactive p-5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E3A8A] flex items-center justify-center text-[#174EA6] dark:text-[#60A5FA]">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-bold text-[#172033] dark:text-[#F1F5F9]">
                  {t('nav.myVehicles')}{' '}
                  {vehiclesCount !== null ? `(${formatNumber(vehiclesCount)})` : ''}
                </div>
                <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">{t('dashboard.manageVehicles')}</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#174EA6] dark:text-[#3B82F6]" />
          </Link>

          <Link
            to="/citizen/challans"
            className="gov-card-interactive p-5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] dark:bg-[#451A03] border border-[#FDE68A] dark:border-[#78350F] flex items-center justify-center text-[#D97706] dark:text-[#FBBF24]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-bold text-[#172033] dark:text-[#F1F5F9]">{t('nav.myChallans')}</div>
                <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">{t('common.payNow')}</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#174EA6] dark:text-[#3B82F6]" />
          </Link>
        </div>
      </div>

      {/* OTP Verification Modal for Changing Mobile or Email */}
      {contactModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white dark:bg-[#111C2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-2xl p-6 sm:p-7 relative text-[#172033] dark:text-[#F1F5F9]">
            <button
              type="button"
              onClick={handleCloseContactModal}
              className="absolute top-4 right-4 text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] transition p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E3A8A] text-[#174EA6] dark:text-[#60A5FA] flex items-center justify-center font-bold">
                {contactModalType === 'mobile' ? (
                  <Phone className="w-5 h-5" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#172033] dark:text-[#F1F5F9]">
                  {contactModalType === 'mobile'
                    ? t('profile.modalUpdatePhone')
                    : t('profile.modalUpdateEmail')}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{t('profile.securityNote')}</p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 rounded-lg flex items-center gap-2 text-[#DC2626] dark:text-[#F87171] text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="mb-4 p-3 bg-[#ECFDF5] dark:bg-[#064E3B]/30 border border-[#A7F3D0] dark:border-[#059669]/40 rounded-lg flex items-center gap-2 text-[#16856B] dark:text-[#34D399] text-xs">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {!otpStep ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#172033] dark:text-[#F1F5F9] mb-1.5">
                    {contactModalType === 'mobile'
                      ? t('profile.newPhoneLabel')
                      : t('profile.newEmailLabel')}
                  </label>
                  <input
                    type={contactModalType === 'mobile' ? 'tel' : 'email'}
                    value={newContactValue}
                    onChange={(e) => setNewContactValue(e.target.value)}
                    placeholder={
                      contactModalType === 'mobile' ? '9820012345' : 'citizen@example.com'
                    }
                    maxLength={contactModalType === 'mobile' ? 10 : 80}
                    required
                    className="gov-input"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseContactModal}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || !newContactValue.trim()}
                    className="btn-primary text-xs py-2 px-4"
                  >
                    {modalLoading ? t('auth.sendingOtp') : t('profile.sendOtp')}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndUpdateContact} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">
                      {t('profile.enterOtpLabel')}
                    </label>
                    <span className="text-xs font-mono font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      {newContactValue}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    autoFocus
                    required
                    className="gov-input text-center text-lg font-mono tracking-widest"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">OTP</span>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || modalLoading}
                    onClick={handleRequestOtp}
                    className="font-bold text-[#174EA6] dark:text-[#3B82F6] hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {resendCooldown > 0
                      ? t('auth.resendIn', { seconds: resendCooldown })
                      : t('auth.resendOtp')}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => setOtpStep(false)}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || otpInput.trim().length !== 6}
                    className="btn-success text-xs py-2 px-4"
                  >
                    {modalLoading ? t('auth.verifying') : t('profile.verifyAndUpdate')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
