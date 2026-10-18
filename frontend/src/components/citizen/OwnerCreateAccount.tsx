import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  User,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, getDemoUserId } from '../../services/supabaseClient';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';

export const OwnerCreateAccount: React.FC = () => {
  const navigate = useNavigate();
  const { loginOwner } = useAuth();
  const { t } = useLanguage();

  // Step state: 'form' | 'otp' | 'success'
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  // OTP State (6 digits)
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer & UI State
  const [timeLeft, setTimeLeft] = useState(119); // 01:59
  const [timerActive, setTimerActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successName, setSuccessName] = useState('');

  // Countdown effect
  useEffect(() => {
    let interval: any = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Step 1: Submit Form to initiate OTP via Supabase Auth
  const handleInitiateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMob = mobileNumber.replace(/\D/g, '');

    if (!cleanName) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (cleanMob.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMob)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number (starts with 6-9).');
      return;
    }

    if (!isSupabaseConfigured()) {
      setStep('otp');
      setTimeLeft(119);
      setTimerActive(true);
      setTimeout(() => otpInputs.current[0]?.focus(), 150);
      return;
    }

    setLoading(true);
    try {
      // 1. Primary: Use Backend Registration & SMTP OTP Service
      try {
        await api.ownerRegisterInitiate({
          fullName: cleanName,
          email: cleanEmail,
          mobileNumber: cleanMob,
        });
        setStep('otp');
        setTimeLeft(119);
        setTimerActive(true);
        setTimeout(() => otpInputs.current[0]?.focus(), 150);
        return;
      } catch (backendErr: any) {
        if (
          backendErr.message &&
          (backendErr.message.includes('already exists') ||
            backendErr.message.includes('Please log in'))
        ) {
          throw backendErr;
        }

        // 2. Fallback: Supabase Auth
        if (isSupabaseConfigured()) {
          const { error } = await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: {
              shouldCreateUser: true,
              data: {
                full_name: cleanName,
                mobile_number: cleanMob,
                role: 'owner',
              },
            },
          });

          if (error) {
            if (error.status === 429 || error.message.toLowerCase().includes('rate')) {
              throw new Error(
                'For security, you can only request a new code every 60 seconds. Please wait before retrying.'
              );
            }
            throw new Error(error.message || 'Failed to send verification code.');
          }

          setStep('otp');
          setTimeLeft(119);
          setTimerActive(true);
          setTimeout(() => otpInputs.current[0]?.focus(), 150);
          return;
        }

        // 3. Fallback for offline dev
        if (!isSupabaseConfigured()) {
          setStep('otp');
          setTimeLeft(119);
          setTimerActive(true);
          setTimeout(() => otpInputs.current[0]?.focus(), 150);
          return;
        }

        throw backendErr;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initiate registration.');
    } finally {
      setLoading(false);
    }
  };

  // OTP input handling
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || '';
    }
    setOtp(newOtp);
    const nextIdx = Math.min(pasted.length, 5);
    otpInputs.current[nextIdx]?.focus();
  };

  // Step 2: Verify OTP via Supabase Auth and activate account
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('').trim();
    if (code.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const cleanMob = mobileNumber.replace(/\D/g, '');

      // 1. Primary: Verify via Backend API
      try {
        const synced = await api.ownerRegisterVerify({
          fullName: cleanName,
          email: cleanEmail,
          mobileNumber: cleanMob,
          code,
        });

        setSuccessName(cleanName);
        setStep('success');
        loginOwner(synced.user, synced.token);

        setTimeout(() => {
          navigate('/citizen/dashboard');
        }, 1800);
        return;
      } catch (backendErr: any) {
        if (
          backendErr.message &&
          (backendErr.message.includes('Incorrect OTP') ||
            backendErr.message.includes('Invalid or expired OTP') ||
            backendErr.message.includes('Too many incorrect'))
        ) {
          throw backendErr;
        }

        // 2. Fallback: Supabase Auth
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: code,
            type: 'email',
          });

          if (error || !data.user) {
            throw new Error(error?.message || 'Invalid or expired verification code. Please try again.');
          }

          const synced = await api.syncOwnerProfile({
            userId: data.user.id,
            email: data.user.email || cleanEmail,
            fullName: cleanName,
            mobileNumber: cleanMob,
          });

          setSuccessName(cleanName);
          setStep('success');
          loginOwner(synced.user, synced.token);

          setTimeout(() => {
            navigate('/citizen/dashboard');
          }, 1800);
          return;
        }

        // 3. Dev offline fallback
        if (!isSupabaseConfigured()) {
          const synced = await api.syncOwnerProfile({
            userId: getDemoUserId(cleanEmail),
            email: cleanEmail,
            fullName: cleanName,
            mobileNumber: cleanMob,
          });

          setSuccessName(cleanName);
          setStep('success');
          loginOwner(synced.user, synced.token);
          setTimeout(() => {
            navigate('/citizen/dashboard');
          }, 1800);
          return;
        }

        throw backendErr;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP via Backend API or Supabase Auth fallback
  const handleResendOtp = async () => {
    if (timeLeft > 0 && timerActive) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      try {
        await api.ownerResendOtp(cleanEmail);
      } catch (backendErr) {
        if (isSupabaseConfigured()) {
          const cleanName = fullName.trim();
          const cleanMob = mobileNumber.replace(/\D/g, '');
          const { error } = await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: {
              shouldCreateUser: true,
              data: {
                full_name: cleanName,
                mobile_number: cleanMob,
                role: 'owner',
              },
            },
          });
          if (error) {
            if (error.status === 429 || error.message.toLowerCase().includes('rate')) {
              throw new Error('Please wait 60 seconds before requesting another code.');
            }
            throw new Error(error.message || 'Failed to resend verification code.');
          }
        }
      }

      setTimeLeft(119);
      setTimerActive(true);
      setOtp(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-smart-traffic-hero flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-md mb-4 flex justify-end">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md gov-card p-6 sm:p-8">
        {/* Government Header Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#EFF6FF] dark:bg-[#162238] border border-[#BFDBFE] dark:border-[#24344D] text-[#3B82F6] dark:text-[#38BDF8] mb-3.5 shadow-sm">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="px-3 py-0.5 mb-2 rounded-full bg-[#EFF6FF] dark:bg-[#3B82F6]/15 text-[#3B82F6] dark:text-[#38BDF8] text-[11px] font-bold tracking-wider uppercase border border-[#BFDBFE] dark:border-[#3B82F6]/30 block mx-auto w-fit">
            {t('auth.ownerPortalBadge')}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
            {step === 'otp'
              ? t('auth.enterOtp')
              : step === 'success'
              ? t('status.verified')
              : t('auth.registerTitle')}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1.5 leading-relaxed">
            {step === 'otp'
              ? t('auth.otpSentTo', { destination: email })
              : step === 'success'
              ? t('dashboard.welcome', { name: successName })
              : t('auth.registerSubtitle')}
          </p>
        </div>

        {/* Notice for local dev when Supabase Anon key is not yet pasted */}
        {!isSupabaseConfigured() && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 text-[#92400E] dark:text-[#FDE68A] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#92400E] dark:text-[#FDE68A]">Dev Testing Mode Active</p>
              <p className="text-[11px] text-[#B45309] dark:text-[#FCD34D] mt-0.5">
                {step === 'otp'
                  ? 'Enter any 6 digits (e.g. 123456) to verify and activate your owner account.'
                  : 'Simulated OTP mode is active. Fill out the form below to test registration.'}
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#FEF2F2] dark:bg-[#EF4444]/10 border border-[#FECACA] dark:border-[#EF4444]/30 text-[#DC2626] dark:text-[#F87171] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#EF4444] flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{errorMsg}</p>
          </div>
        )}

        {/* SUCCESS SCREEN */}
        {step === 'success' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#A7F3D0] dark:border-[#10B981]/30 text-[#16856B] dark:text-[#34D399] mx-auto flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#172033] dark:text-[#F1F5F9]">Account created successfully.</h2>
              <p className="text-sm font-semibold text-[#16856B] dark:text-[#34D399]">
                {t('dashboard.welcome', { name: successName })}
              </p>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{t('common.loading')}</p>
          </div>
        )}

        {/* STEP 1: REGISTRATION FORM */}
        {step === 'form' && (
          <form onSubmit={handleInitiateRegistration} className="space-y-4 text-xs sm:text-sm">
            {/* Full Name */}
            <div>
              <label htmlFor="full-name" className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1.5">
                {t('auth.fullNameLabel')} <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <input
                  id="full-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('auth.fullNamePlaceholder')}
                  className="gov-input pr-10"
                />
                <User className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="email" className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1.5">
                {t('auth.emailLabel')} <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="gov-input pr-10"
                />
                <Mail className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Mobile Number */}
            <div>
              <label htmlFor="mobile" className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1.5">
                {t('auth.phoneLabel')} <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative flex">
                <span className="inline-flex items-center px-3.5 rounded-l-lg border border-r-0 border-[#CBD5E1] dark:border-[#24344D] bg-[#F5F7FB] dark:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] font-semibold text-xs">
                  +91
                </span>
                <input
                  id="mobile"
                  type="tel"
                  required
                  autoComplete="tel"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder={t('auth.phonePlaceholder')}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0D1524] border border-[#CBD5E1] dark:border-[#24344D] rounded-r-lg text-[#172033] dark:text-[#F1F5F9] placeholder-[#64748B] dark:placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6] text-sm font-mono transition"
                />
                <Phone className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 btn-primary py-3 text-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> {t('auth.sendingOtp')}
                </>
              ) : (
                <>
                  {t('auth.sendLoginOtp')} <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B] text-center">
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {t('auth.haveAccount')}{' '}
                <Link to="/citizen/login" className="font-bold text-[#3B82F6] dark:text-[#38BDF8] hover:underline">
                  {t('auth.signInLink')}
                </Link>
              </p>
            </div>
          </form>
        )}

        {/* STEP 2: OTP VERIFICATION SCREEN */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5 text-xs sm:text-sm">
            <div>
              <label className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-2.5 text-center">
                {t('auth.enterOtp')}
              </label>

              {/* 6 Individual OTP input boxes */}
              <div className="flex justify-center items-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-12 sm:w-12 sm:h-14 text-center font-mono font-bold text-xl bg-white dark:bg-[#0D1524] border-2 border-[#CBD5E1] dark:border-[#24344D] rounded-xl text-[#172033] dark:text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 transition"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
            </div>

            {/* Timer and Resend */}
            <div className="flex items-center justify-between text-xs px-1 text-[#64748B] dark:text-[#94A3B8]">
              <span className="text-[#64748B] dark:text-[#94A3B8]">
                OTP: <strong className="font-mono text-[#D97706] dark:text-[#F59E0B] font-bold">{formatTime(timeLeft)}</strong>
              </span>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={timeLeft > 0 && timerActive}
                className="font-bold text-[#3B82F6] dark:text-[#38BDF8] hover:underline disabled:text-[#64748B] dark:disabled:text-[#475569] disabled:no-underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('auth.resendOtp')}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full btn-success py-3 text-sm"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> {t('auth.verifying')}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> {t('auth.verifyAndRegister')}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setErrorMsg(null);
                }}
                className="w-full py-2 text-center text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] transition"
              >
                {t('auth.changeContact')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
