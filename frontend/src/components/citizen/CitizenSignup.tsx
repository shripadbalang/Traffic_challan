import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Car, Phone, Mail, User, Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

export const CitizenSignup: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    plateNumber: 'MH12DE1433',
    mobileNumber: '9822012345',
    fullName: 'Rajesh Sharma',
    email: 'rajesh.sharma@example.com',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; otp?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await api.citizenSignup(formData);
      if (res.success) {
        setMessage({
          type: 'success',
          text: res.message,
          otp: res.otp,
        });
        setTimeout(() => {
          navigate('/citizen/login', { state: { mobileNumber: formData.mobileNumber, debugOtp: res.otp } });
        }, 1800);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to complete registration.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-smart-traffic-hero flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 mb-3">
            <Car className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Vehicle Owner Registration</h2>
          <p className="text-xs text-slate-400 mt-1">
            Link your vehicle plate & mobile number for instant SMS alerts & online challan clearance
          </p>
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl mb-5 text-xs flex items-start gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-700/60 text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
            )}
            <div>
              <p>{message.text}</p>
              {message.otp && (
                <p className="font-mono font-bold mt-1 text-amber-300">
                  Simulated OTP: {message.otp}
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Vehicle Number */}
          <div>
            <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
              <span>Vehicle Plate Number *</span>
              <span className="text-[10px] text-blue-400 font-mono">e.g. MH 12 DE 1433</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={formData.plateNumber}
                onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                placeholder="MH12DE1433"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-plate uppercase placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <div className="absolute right-3 top-2.5 text-xs font-bold text-amber-400 pointer-events-none">
                IND
              </div>
            </div>
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Mobile Number (For OTP Verification) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono">+91</span>
              <input
                type="tel"
                required
                maxLength={10}
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                placeholder="9822012345"
                className="w-full pl-12 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Owner Full Name (as per RC) *</label>
            <div className="relative">
              <User className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Rajesh Sharma"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="rajesh@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Password (Optional for OTP flow) */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Account Password (Optional - OTP login supported)
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
          >
            {loading ? 'Registering with RTO...' : 'Create Account & Receive OTP'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/citizen/login" className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4">
            Login via Mobile OTP
          </Link>
        </div>
      </div>
    </div>
  );
};
