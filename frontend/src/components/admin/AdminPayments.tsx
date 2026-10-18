import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Download,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../services/api';
import { AdminPayment } from '../../types';

export const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getAdminPayments({
        search: search || undefined,
        status: statusFilter,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setPayments(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch payment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [search, statusFilter, fromDate, toDate]);

  const totalAmount = payments
    .filter((p) => p.status === 'success' || p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <AdminLayout
      title="Financial & Payment Reconciliation"
      subtitle="Supervise Treasury Collections, Payment Gateways & Transaction Auditing"
    >
      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Verified Treasury Collections
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{totalAmount.toLocaleString('en-IN')}
            </span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Filtered collection total</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Total Transactions
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{total}</span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Recorded in database</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Gateway Status
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-base font-bold text-slate-800 dark:text-slate-200">Razorpay / MahaTreasury</span>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
            Operational (Test / Live Mode)
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by transaction ID, vehicle plate, or owner..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800"
            />
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="success">Success / Paid</option>
              <option value="initiated">Initiated / Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Date Range:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            />
            <span>to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <span>Found {total} records</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-amber-500 rounded-full animate-spin" />
            <span>Loading payment records...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
            <p>No data available matching your filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Transaction / Order ID</th>
                  <th className="py-3 px-4">Challan / Vehicle</th>
                  <th className="py-3 px-4">Owner Name</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Settlement Status</th>
                  <th className="py-3 px-4">Payment Timestamp</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block truncate max-w-xs">
                        {p.transaction_id}
                      </span>
                      {p.razorpay_order_id && p.razorpay_order_id !== p.transaction_id && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate max-w-xs">
                          Order: {p.razorpay_order_id}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{p.vehicle_plate}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate block max-w-xs">
                        {p.challan_id}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-800 dark:text-slate-200">
                      {p.owner_name}
                    </td>
                    <td className="py-3 px-4 font-black text-xs text-emerald-700 dark:text-emerald-400">
                      ₹{p.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          p.status === 'success' || p.status === 'paid'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : p.status === 'failed'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {p.paid_at ? new Date(p.paid_at).toLocaleString('en-IN') : 'Initiated'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.receipt_pdf_path ? (
                        <a
                          href={`/files/receipts/${p.receipt_pdf_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-200 dark:border-slate-700 transition"
                        >
                          <Download className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                          <span>PDF</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">No Receipt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
