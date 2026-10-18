import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, AlertCircle, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { loginOfficerOrAdmin } = useAuth();

  const [email, setEmail] = useState('admin@echallan.gov.in');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid administrator email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your administrator password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.adminLogin(cleanEmail, password);
      if (res.access_token && res.user) {
        loginOfficerOrAdmin(
          {
            ...res.user,
            role: 'admin',
          },
          res.access_token
        );
        navigate('/admin/dashboard');
      } else {
        setErrorMsg('Authentication failed. No administrative token granted.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid administrator email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPreset = () => {
    setEmail('admin@echallan.gov.in');
    setPassword('Admin@123');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-smart-traffic-hero flex items-center justify-center p-4 sm:p-6 transition-colors duration-200 font-sans">
      <div className="w-full max-w-md gov-card p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 border border-[#BFDBFE] dark:border-[#1E3A8A] text-[#174EA6] dark:text-[#60A5FA] mb-3.5 shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="px-3 py-0.5 mb-2 rounded-full bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA] text-[11px] font-bold tracking-wider uppercase border border-[#BFDBFE] dark:border-[#1E3A8A] block mx-auto w-fit">
            MAHARASHTRA TRAFFIC HEADQUARTERS
          </div>
          <h1 className="text-2xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
            Administrator Portal
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1.5 max-w-xs mx-auto leading-relaxed">
            Supervisory access strictly restricted to Department Administrators and System Overseers
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 text-[#DC2626] dark:text-[#F87171] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#F87171] flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed font-semibold">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#172033] dark:text-[#F1F5F9] font-semibold text-xs mb-1.5">
              Official Admin Email <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@echallan.gov.in"
                className="gov-input pr-10"
              />
              <Mail className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute right-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[#172033] dark:text-[#F1F5F9] font-semibold text-xs mb-1.5">
              Password <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <input
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

          {/* Quick preset for testing */}
          <div className="p-3.5 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#172033] dark:text-[#F1F5F9] font-semibold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#174EA6] dark:text-[#3B82F6]" /> Authorized Admin Preset:
              </span>
              <button
                type="button"
                onClick={handleQuickPreset}
                className="text-[11px] font-bold text-[#174EA6] dark:text-[#3B82F6] hover:underline"
              >
                Load Credentials
              </button>
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 font-mono">
              admin@echallan.gov.in • Admin@123
            </p>
          </div>

          <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-sm">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Verifying Credentials...
              </span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In to Admin Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B] text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
          <p>Restricted to Authorized Department Personnel</p>
        </div>
      </div>
    </div>
  );
};
