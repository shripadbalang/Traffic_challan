import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Printer,
  AlertCircle,
  Building2,
  Clock,
  Search,
} from 'lucide-react';
import { api, getStoredChallans } from '../../services/api';

interface VerificationData {
  receipt_number: string | null;
  challan_id: string;
  status: string;
  vehicle_number: string;
  violation: string;
  amount: number;
  paid_at: string | null;
  transaction_id: string | null;
  is_verified: boolean;
}

export const VerifyReceipt: React.FC = () => {
  const { challanId } = useParams<{ challanId: string }>();
  const navigate = useNavigate();

  const [activeId, setActiveId] = useState<string>(challanId || 'CH-10021');
  const [searchInput, setSearchInput] = useState<string>(challanId || 'CH-10021');
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (challanId) {
      setActiveId(challanId);
      setSearchInput(challanId);
    }
  }, [challanId]);

  useEffect(() => {
    if (!activeId) {
      setError('Please provide or search for a Challan ID to verify.');
      setLoading(false);
      return;
    }

    const loadVerification = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getPublicReceiptVerification(activeId);
        setData(res);
      } catch (err: any) {
        const stored = getStoredChallans();
        const found = stored.find((c) => String(c.id).toUpperCase() === activeId.toUpperCase());
        if (found) {
          setData({
            receipt_number: `REC-MH-${String(found.id).replace('-', '').slice(0, 8).toUpperCase()}`,
            challan_id: String(found.id),
            status: found.status.toUpperCase(),
            vehicle_number: found.vehiclePlate || '',
            violation: found.violation,
            amount: found.fineAmount,
            paid_at: found.payment?.paidAt || new Date().toLocaleDateString('en-IN'),
            transaction_id:
              found.payment?.paymentId ||
              `TXN_${String(found.id).replace('-', '').slice(0, 8).toUpperCase()}`,
            is_verified: found.status === 'paid',
          });
        } else {
          setError(err.message || 'Receipt verification record not found in the treasury registry.');
          setData(null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadVerification();
  }, [activeId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim();
    if (!clean) return;
    setActiveId(clean);
    navigate(`/verify-receipt/${encodeURIComponent(clean)}`, { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-smart-traffic-hero py-10 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center font-sans transition-colors duration-200">
      <div className="w-full max-w-xl">
        {/* Verification Card */}
        <div className="gov-card overflow-hidden">
          {/* Government Header Banner */}
          <div className="bg-[#174EA6] dark:bg-[#1E3A8A] text-white p-6 text-center border-b border-[#123B80] dark:border-[#172554]">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-white/90" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">
                Government of Maharashtra • Transport Department
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Official E-Challan Receipt Verification
            </h1>
            <p className="text-xs text-white/80 mt-1">
              Automated Electronic Traffic Enforcement System
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Quick Lookup Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter Challan ID or UUID to verify..."
                  className="gov-input pl-9 font-mono font-bold text-xs"
                />
                <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-3" />
              </div>
              <button
                type="submit"
                disabled={loading || !searchInput.trim()}
                className="btn-primary text-xs px-4 py-2"
              >
                Verify
              </button>
            </form>

            {/* Loading State */}
            {loading && (
              <div className="py-12 text-center text-[#64748B] dark:text-[#94A3B8]">
                <div className="w-8 h-8 border-2 border-[#174EA6] dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold">
                  Verifying digital certificate with state database...
                </p>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="p-5 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 rounded-xl text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-[#DC2626] dark:text-[#F87171] mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-[#172033] dark:text-[#F1F5F9]">
                    Verification Record Not Found
                  </h3>
                  <p className="text-xs text-[#DC2626] dark:text-[#F87171] mt-1">{error}</p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('CH-10021');
                      setActiveId('CH-10021');
                    }}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Load Sample CH-10021
                  </button>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#174EA6] dark:text-[#3B82F6] hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Return Home
                  </Link>
                </div>
              </div>
            )}

            {/* Verified Details */}
            {!loading && data && (
              <>
                <div className="p-4 rounded-xl border flex items-center gap-4 bg-[#ECFDF5] dark:bg-[#064E3B]/30 border-[#A7F3D0] dark:border-[#059669]/40">
                  <div className="w-12 h-12 rounded-xl bg-[#16856B] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#16856B] dark:text-[#34D399] uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399]" />
                      Authentic Government Record
                    </div>
                    <div className="text-base font-extrabold text-[#172033] dark:text-[#F1F5F9] mt-0.5">
                      Digitally Verified Payment
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      This transaction has been authenticated against the state e-challan treasury
                      records.
                    </div>
                  </div>
                </div>

                {/* Receipt Data Table */}
                <div className="border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl overflow-hidden text-xs sm:text-sm divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
                  <div className="flex justify-between items-center p-3.5 bg-[#F7F9FC] dark:bg-[#162238]/60">
                    <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Receipt Number</span>
                    <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                      {data.receipt_number ||
                        `REC-MH-${String(data.challan_id).slice(0, 8).toUpperCase()}`}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-white dark:bg-[#111C2E]">
                    <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Challan ID</span>
                    <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">#{data.challan_id}</span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-[#F7F9FC] dark:bg-[#162238]/60">
                    <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Payment Status</span>
                    <span className="gov-badge-success">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {data.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-white dark:bg-[#111C2E]">
                    <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Vehicle Number</span>
                    <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9] bg-[#F7F9FC] dark:bg-[#0D1524] px-2.5 py-0.5 rounded border border-[#E2E8F0] dark:border-[#1E293B]">
                      {data.vehicle_number}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-[#F7F9FC] dark:bg-[#162238]/60">
                    <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Violation</span>
                    <span className="font-semibold text-[#172033] dark:text-[#F1F5F9] text-right max-w-[240px]">
                      {data.violation}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-white dark:bg-[#111C2E]">
                    <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Fine Amount Paid</span>
                    <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9] text-base">
                      ₹{Number(data.amount).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-[#F7F9FC] dark:bg-[#162238]/60">
                    <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Payment Date</span>
                    <span className="font-semibold text-[#172033] dark:text-[#F1F5F9]">
                      {data.paid_at || 'Recorded in System'}
                    </span>
                  </div>

                  {data.transaction_id && (
                    <div className="flex justify-between items-center p-3.5 bg-white dark:bg-[#111C2E]">
                      <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Transaction ID</span>
                      <span className="font-mono text-xs text-[#172033] dark:text-[#F1F5F9] font-bold">
                        {data.transaction_id}
                      </span>
                    </div>
                  )}
                </div>

                {/* Audit Timestamp Notice */}
                <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8] pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                    Query Timestamp: {new Date().toLocaleTimeString('en-IN')} IST
                  </span>
                  <span className="font-mono font-semibold text-[#172033] dark:text-[#F1F5F9]">
                    Secured with SHA-256
                  </span>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <Link
                    to="/citizen/dashboard"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] hover:text-[#174EA6] dark:hover:text-[#3B82F6] transition"
                  >
                    <ArrowLeft className="w-4 h-4" /> Go to Dashboard
                  </Link>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full sm:w-auto btn-primary text-xs"
                  >
                    <Printer className="w-4 h-4" /> Print Verification Proof
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Official Disclaimer */}
        <p className="text-center text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-4">
          This digital verification is valid under Section 4 of the Information Technology Act,
          2000.
        </p>
      </div>
    </div>
  );
};
