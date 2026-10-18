import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  Filter,
  Eye,
  X,
  CheckCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
  Image as ImageIcon,
  DollarSign,
  ShieldCheck,
  CreditCard,
  User,
  Cpu,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../services/api';

export const AdminChallans: React.FC = () => {
  const [challans, setChallans] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [violationFilter, setViolationFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const limit = 30;

  // Detail & Status Modal
  const [selectedChallanId, setSelectedChallanId] = useState<string | null>(null);
  const [challanDetail, setChallanDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('pending');
  const [statusNotes, setStatusNotes] = useState('');

  const fetchChallans = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getAdminChallans({
        search: search || undefined,
        status: statusFilter,
        violation_code: violationFilter,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        limit,
        offset: page * limit,
      });
      setChallans(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch challans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallans();
  }, [search, statusFilter, violationFilter, fromDate, toDate, page]);

  const handleOpenDetail = async (id: string) => {
    setSelectedChallanId(id);
    setDetailLoading(true);
    try {
      const detail = await api.getAdminChallanDetail(id);
      setChallanDetail(detail);
      setNewStatus(detail.status);
      setStatusNotes('');
    } catch {
      setChallanDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedChallanId) return;
    setUpdatingStatus(true);
    setErrorMsg(null);
    try {
      await api.updateAdminChallanStatus(selectedChallanId, newStatus, statusNotes);
      setSuccessMsg(`Challan ${selectedChallanId} status updated to ${newStatus.toUpperCase()}.`);
      // Update local state
      setChallans((prev) =>
        prev.map((c) => (c.id === selectedChallanId ? { ...c, status: newStatus } : c))
      );
      if (challanDetail) {
        setChallanDetail({ ...challanDetail, status: newStatus });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update challan status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <AdminLayout
      title="E-Challan Supervisory Management"
      subtitle="Examine All Issued Challans, Review High-Resolution Evidence, Inspect Payment Status & Resolve Disputes"
    >
      {/* Search & Comprehensive Filter Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search by Challan ID, plate number, or owner name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800"
            />
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-bold">
              <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="pending">Pending (Unpaid)</option>
              <option value="paid">Paid</option>
              <option value="disputed">Disputed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Violation Filter */}
            <select
              value={violationFilter}
              onChange={(e) => {
                setViolationFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Violation Types</option>
              <option value="NO_HELMET">No Helmet</option>
              <option value="TRIPLE_RIDING">Triple Riding</option>
              <option value="WRONG_SIDE_DRIVING">Wrong Side</option>
              <option value="MOBILE_PHONE_USAGE">Mobile Phone Usage</option>
            </select>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Date Range:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            />
            <span className="text-slate-400 dark:text-slate-500">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            />
            {(fromDate || toDate) && (
              <button
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-[11px]"
              >
                Clear Dates
              </button>
            )}
          </div>

          <div className="text-slate-500 dark:text-slate-400 font-medium">
            Found <strong className="text-slate-900 dark:text-slate-100">{total}</strong> challan{total === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 dark:text-emerald-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700 dark:text-rose-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Challans Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-amber-500 rounded-full animate-spin" />
            <span>Loading challans from database...</span>
          </div>
        ) : challans.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
            <p>No data available matching your filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Challan ID / Vehicle</th>
                  <th className="py-3 px-4">Owner Name</th>
                  <th className="py-3 px-4">Violation Details</th>
                  <th className="py-3 px-4">Fine Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Source / Officer</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {challans.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">{c.id}</span>
                      <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 inline-block mt-0.5">
                        {c.vehicle_plate}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{c.owner_name}</span>
                      {c.owner_mobile && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">+91 {c.owner_mobile}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{c.violation_name}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{c.violation_code}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-black text-xs text-slate-900 dark:text-slate-100 block">
                        ₹{c.fine_amount.toLocaleString('en-IN')}
                      </span>
                      <span
                        className={`text-[10px] font-bold block ${
                          c.payment_status === 'success' || c.status === 'paid'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {c.payment_status === 'success' || c.status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                          c.status === 'paid'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : c.status === 'disputed'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : c.status === 'cancelled'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        {c.detection_source === 'ai' ? (
                          <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                        )}
                        <span className="uppercase text-[11px]">{c.detection_source}</span>
                      </span>
                      {c.officer_badge && (
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {c.officer_badge}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {c.violation_datetime
                        ? new Date(c.violation_datetime).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenDetail(c.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {total > limit && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>
              Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <button
                disabled={(page + 1) * limit >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CHALLAN DETAIL & SUPERVISION MODAL */}
      {selectedChallanId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{selectedChallanId}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Plate: {challanDetail?.vehicle_plate || '...'} • Fine: ₹{challanDetail?.violation?.fine_amount || 0}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedChallanId(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading || !challanDetail ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                <span>Loading challan metadata & evidence...</span>
              </div>
            ) : (
              <>
                {/* Primary Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Violation Type</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">{challanDetail.violation.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{challanDetail.violation.legal_section}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Registered Owner</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                      {challanDetail.owner?.full_name || 'Unregistered'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {challanDetail.owner?.mobile_number ? `+91 ${challanDetail.owner.mobile_number}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Detection Source</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase block mt-0.5">
                      {challanDetail.detection_source}
                      {challanDetail.ai_confidence_score
                        ? ` (${Math.round(challanDetail.ai_confidence_score * 100)}% conf)`
                        : ''}
                    </span>
                    {challanDetail.officer && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Officer: {challanDetail.officer.full_name} ({challanDetail.officer.badge_number})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Fine Assessment</span>
                    <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm block mt-0.5">
                      ₹{challanDetail.violation.fine_amount}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                      Status: {challanDetail.status}
                    </span>
                  </div>
                </div>

                {/* Evidence Inspection */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    Violation Evidence Captured
                  </h4>

                  {challanDetail.evidence && challanDetail.evidence.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      {challanDetail.evidence.map((ev: any) => (
                        <div key={ev.id} className="space-y-1.5">
                          <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 dark:border-slate-700 relative">
                            {ev.file_path ? (
                              <img
                                src={ev.file_path.startsWith('http') || ev.file_path.startsWith('/') ? ev.file_path : `/files/evidence/${ev.file_path}`}
                                alt="Violation Evidence"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/samples/helmet_violation.jpg';
                                }}
                              />
                            ) : (
                              <span className="text-xs text-slate-400">Evidence file not available</span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block truncate">
                            File: {ev.file_path}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-center">
                      No photographic evidence attached to this record.
                    </p>
                  )}
                </div>

                {/* Payment History */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    Payment Settlement Information
                  </h4>
                  {challanDetail.payment ? (
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Payment Status</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 block uppercase">
                          {challanDetail.payment.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Amount Credited</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          ₹{challanDetail.payment.amount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Transaction ID</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 block text-[11px]">
                          {challanDetail.payment.transaction_id || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Settlement Date</span>
                        <span className="text-slate-800 dark:text-slate-200 block text-[11px]">
                          {challanDetail.payment.paid_at
                            ? new Date(challanDetail.payment.paid_at).toLocaleString('en-IN')
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                      Unpaid Challan. No payment transaction recorded yet.
                    </div>
                  )}
                </div>

                {/* Status Updater for Admin */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    Supervisory Status Adjustment & Dispute Resolution
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1">
                        Challan Status
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100"
                      >
                        <option value="pending">PENDING (UNPAID)</option>
                        <option value="paid">PAID (SETTLED)</option>
                        <option value="disputed">UNDER DISPUTE</option>
                        <option value="cancelled">CANCELLED / WAIVED</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1">
                        Audit Reasoning / Notes
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={statusNotes}
                          onChange={(e) => setStatusNotes(e.target.value)}
                          placeholder="e.g. Approved dispute claim / Waived after review"
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                        <button
                          type="button"
                          onClick={handleUpdateStatus}
                          disabled={updatingStatus}
                          className="px-4 py-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-bold rounded-xl text-xs whitespace-nowrap transition disabled:opacity-50"
                        >
                          {updatingStatus ? 'Saving...' : 'Apply Status'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedChallanId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
