import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Car,
  Phone,
  KeyRound,
  ArrowRight,
  Shield,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export const CitizenOtpLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginCitizen } = useAuth();

  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [vehicleNumber, setVehicleNumber] = useState('MH 37 AB 0949');
  const [mobileNumber, setMobileNumber] = useState('7001336011');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [maskedMobile, setMaskedMobile] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes

  // Auto-fill from registration redirect if available
  useEffect(() => {
    if (location.state?.vehicleNumber) {
      setVehicleNumber(location.state.vehicleNumber);
    }
    if (location.state?.mobileNumber) {
      setMobileNumber(location.state.mobileNumber);
    }
  }, [location.state]);

  useEffect(() => {
    let timer: any;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = vehicleNumber.replace(/[\s-]+/g, '').toUpperCase();
    const cleanMobile = mobileNumber.replace(/\D/g, '');

    if (!cleanPlate || cleanPlate.length < 6) {
      setError('Please enter a valid vehicle registration number (e.g. MH 37 AB 0949).');
      return;
    }
    if (!cleanMobile || cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit registered mobile number.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await api.requestOwnerOtp(vehicleNumber, mobileNumber);
      if (res.success) {
        setMaskedMobile(res.maskedMobile || `******${cleanMobile.slice(-4)}`);
        setOwnerName(res.ownerName || 'Vehicle Owner');
        setDebugOtp(res.debugOtp || null);
        setStep('otp');
        setCountdown(300);
      }
    } catch (err: any) {
      // Must display the exact mandated error if mismatch / not registered
      setError(
        err?.message ||
          'Vehicle or mobile number is not registered. Please check your details or contact the concerned authority.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setError('Please enter the 6-digit OTP received on your mobile.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await api.verifyOwnerOtp(vehicleNumber, mobileNumber, otpCode.trim());
      if (res.success) {
        loginCitizen(res.user, res.token);
        navigate('/citizen/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired OTP. Please check your OTP or request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-smart-traffic-hero text-slate-900 py-10 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white border border-slate-300 rounded-xl shadow-lg overflow-hidden">
        {/* Government Portal Header Bar */}
        <div className="bg-[#0f2942] text-white p-5 border-b-4 border-amber-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-amber-400">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold block">
                Government of Maharashtra • Transport Department
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Vehicle Owner E-Challan Portal
              </h1>
              <p className="text-xs text-slate-300">
                Official Citizen Login & Citation Verification Desk
              </p>
            </div>
          </div>
        </div>

        {/* Portal Notice Banner */}
        <div className="bg-blue-50 border-b border-blue-200 px-5 py-2.5 flex items-center gap-2 text-xs text-blue-900">
          <Shield className="w-4 h-4 text-blue-700 flex-shrink-0" />
          <span>
            Authorized vehicle owners can view pending dues, review photographic proofs, and settle citations securely.
          </span>
        </div>

        <div className="p-6 sm:p-8">
          {/* Debug Helper for Demo / Testing */}
          {debugOtp && step === 'otp' && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs">
              <div className="flex items-center gap-2 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                <span>Simulated SMS Gateway Received:</span>
              </div>
              <p className="text-slate-700">
                "Your MahaTraffic portal login code is{' '}
                <strong className="text-amber-800 font-mono text-sm underline">{debugOtp}</strong>. Valid for 5 minutes."
              </p>
              <button
                type="button"
                onClick={() => setOtpCode(debugOtp)}
                className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900 underline block"
              >
                Click here to auto-fill OTP ({debugOtp})
              </button>
            </div>
          )}

          {/* Error Message Box */}
          {error && (
            <div
              role="alert"
              className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-600 rounded-r-lg text-rose-900 text-xs flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-800">Authentication Error</p>
                <p className="mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  1. Vehicle Registration Number / Number Plate <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-3 text-slate-400">
                    <Car className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. MH 37 AB 0949"
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base uppercase font-semibold placeholder:font-sans placeholder:font-normal placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter your vehicle registration number as recorded in RTO Vahan database.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  2. Registered Mobile Number <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-mono text-sm font-semibold">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 7001336011"
                    className="w-full pl-14 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-base font-semibold placeholder:font-sans placeholder:font-normal placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter the 10-digit mobile number linked to this vehicle in the database.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Database Test Accounts:</p>
                <p>
                  • <strong>Payal Sune</strong>: Vehicle <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono">MH 37 AB 0949</code> or <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono">MH 27 BU 6590</code> • Mobile <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono">7001336011</code>
                </p>
                <p>
                  • <strong>Shripad Balang</strong>: Vehicle <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono">MH 37 AB 0940</code> • Mobile <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono">9307716594</code>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#0f2942] hover:bg-[#1a3d61] text-white font-semibold text-sm shadow-sm transition disabled:opacity-60"
              >
                {loading ? 'Verifying Registration Records...' : 'Get Login OTP'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500">Registered Owner:</span>
                  <strong className="text-slate-900 font-bold">{ownerName}</strong>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500">Vehicle Number:</span>
                  <strong className="text-slate-900 font-mono">{vehicleNumber}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">OTP Sent To:</span>
                  <strong className="text-slate-900 font-mono">+91 {maskedMobile}</strong>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Enter 6-Digit OTP Code <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setError(null);
                    }}
                    className="text-xs text-blue-700 hover:underline font-semibold"
                  >
                    Change Details
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.trim())}
                    placeholder="Enter 6-digit OTP"
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-lg tracking-widest font-bold placeholder:font-normal placeholder:tracking-normal placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                  <span>
                    OTP valid for: <strong className="text-amber-700 font-mono">{formatTime(countdown)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={countdown > 240}
                    className="text-blue-700 hover:text-blue-900 disabled:opacity-40 disabled:hover:no-underline underline flex items-center gap-1 font-semibold"
                  >
                    <RefreshCw className="w-3 h-3" /> Resend OTP
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-sm transition disabled:opacity-60"
              >
                <Lock className="w-4 h-4" />
                {loading ? 'Verifying OTP...' : 'Verify OTP & Access Dashboard'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-200 text-center text-xs text-slate-600">
            Need assistance or reporting an issue?{' '}
            <span className="font-semibold text-slate-800">Toll-Free Helpline: 1800-22-0110</span>
          </div>
        </div>
      </div>
    </div>
  );
};
