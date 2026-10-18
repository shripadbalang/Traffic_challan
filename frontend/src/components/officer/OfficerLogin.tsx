import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export const OfficerLogin: React.FC = () => {
  const navigate = useNavigate();
  const { loginOfficerOrAdmin } = useAuth();

  const [email, setEmail] = useState('officer@traffic.gov.in');
  const [password, setPassword] = useState('Traffic@123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid official email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.officerLogin(cleanEmail, password);
      if (res.success && res.access_token) {
        const authPayload = {
          ...res.user,
          badgeNumber: res.officer?.badgeNumber || 'N/A',
          station: res.officer?.station || 'Traffic Division',
          jurisdiction: res.officer?.jurisdiction || 'General Zone',
          officerId: res.officer?.id,
        };
        localStorage.setItem('auth_token', res.access_token);
        loginOfficerOrAdmin(authPayload, res.access_token);
        navigate('/officer/dashboard');
      } else {
        setErrorMsg('Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid official email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPreset = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-smart-traffic-hero flex items-center justify-center p-4 sm:p-6 transition-colors duration-200 font-sans">
      <div className="w-full max-w-md gov-card p-6 sm:p-8">
        {/* Official Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFFBEB] dark:bg-[#451A03] border border-[#FDE68A] dark:border-[#78350F] text-[#D97706] dark:text-[#FBBF24] mb-3.5 shadow-sm">
            <Shield className="w-7 h-7" />
          </div>
          <div className="px-3 py-0.5 mb-2 rounded-full bg-[#FFFBEB] dark:bg-[#451A03] text-[#D97706] dark:text-[#FBBF24] text-[11px] font-bold tracking-wider uppercase border border-[#FDE68A] dark:border-[#78350F] block mx-auto w-fit">
            MAHARASHTRA TRAFFIC POLICE
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
            Traffic Officer Portal
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1.5">
            Restricted access for authorized field traffic enforcement officers
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 text-[#DC2626] dark:text-[#F87171] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#F87171] flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Official Email */}
          <div>
            <label htmlFor="official-email" className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1.5 text-xs">
              Official Email <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <input
                id="official-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@traffic.gov.in"
                className="gov-input pr-10"
              />
              <Mail className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute right-3.5 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
              Assigned police department email address
            </p>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="officer-password"
              className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1.5 text-xs"
            >
              Password <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <input
                id="officer-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="gov-input pr-10"
              />
              <Lock className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute right-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Quick Preset Credentials for Testing */}
          <div className="p-3.5 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] text-xs space-y-2">
            <span className="text-[#172033] dark:text-[#F1F5F9] font-semibold flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#D97706] dark:text-[#FBBF24]" /> Authorized Officer Presets:
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleQuickPreset('officer@traffic.gov.in', 'Traffic@123')}
                className="flex-1 py-2 px-2.5 rounded-lg bg-white dark:bg-[#111C2E] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/30 text-[#172033] dark:text-[#F1F5F9] hover:text-[#174EA6] dark:hover:text-[#3B82F6] text-[11px] font-semibold border border-[#E2E8F0] dark:border-[#1E293B] transition text-center"
              >
                Inspector Vikas
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('officer1@echallan.gov.in', 'Officer@123')}
                className="flex-1 py-2 px-2.5 rounded-lg bg-white dark:bg-[#111C2E] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/30 text-[#172033] dark:text-[#F1F5F9] hover:text-[#174EA6] dark:hover:text-[#3B82F6] text-[11px] font-semibold border border-[#E2E8F0] dark:border-[#1E293B] transition text-center"
              >
                Officer 1
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-xs tracking-wider uppercase font-bold"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Authenticating Officer ID...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Access Enforcement Portal <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-5 border-t border-[#E2E8F0] dark:border-[#1E293B] text-center">
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            Notice: Unauthorized access attempts are monitored and prosecuted under IT Act, 2000.
          </p>
        </div>
      </div>
    </div>
  );
};
