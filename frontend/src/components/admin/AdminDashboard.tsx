import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck2,
  DollarSign,
  Users,
  Car,
  Shield,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  FileSpreadsheet,
  PlusCircle,
  RefreshCw,
  Calendar,
  Layers,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../services/api';
import { AdminDashboardStats } from '../../types';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getAdminDashboardStats();
      setStats(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load live database metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <AdminLayout
      title="Supervisory Dashboard"
      subtitle="Maharashtra Traffic Enforcement & Revenue Operations Overview"
    >
      {/* Header controls & Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 gov-card p-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16856B] dark:bg-[#34D399] animate-pulse" />
          <span className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wide">
            Live Database Synced
          </span>
          <span className="text-[#64748B] dark:text-[#94A3B8]">•</span>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        <button
          onClick={fetchStats}
          disabled={loading}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 text-[#DC2626] dark:text-[#F87171] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] dark:text-[#F87171] flex-shrink-0" />
            <p className="font-semibold">{errorMsg}</p>
          </div>
          <button
            onClick={fetchStats}
            className="px-2.5 py-1 bg-[#FEF2F2] hover:bg-[#FEE2E2] dark:bg-[#7F1D1D]/50 text-[#DC2626] dark:text-[#F87171] rounded font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !stats && (
        <div className="py-20 flex flex-col items-center justify-center text-[#64748B] dark:text-[#94A3B8] space-y-3">
          <div className="w-8 h-8 border-2 border-[#174EA6] dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Querying live Supabase PostgreSQL tables...</p>
        </div>
      )}

      {/* Statistics Cards Grid */}
      {stats && (
        <>
          {/* Operations Today Bar */}
          <div className="bg-gradient-to-r from-[#0B1220] via-[#111C2E] to-[#162238] rounded-2xl p-5 text-white border border-[#1E293B] shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FBBF24]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#FBBF24]">
                  Operations Today (24-Hour Window)
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300">
                Live Counters
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Challans Today</span>
                <span className="text-2xl font-black text-white mt-1 block">
                  {stats.challans_today > 0 ? stats.challans_today.toLocaleString('en-IN') : '0'}
                </span>
                <span className="text-[10px] text-emerald-400 mt-0.5 block">Issued across zones</span>
              </div>

              <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Violations Detected</span>
                <span className="text-2xl font-black text-amber-300 mt-1 block">
                  {stats.violations_today > 0 ? stats.violations_today.toLocaleString('en-IN') : '0'}
                </span>
                <span className="text-[10px] text-slate-300 mt-0.5 block">AI & field detections</span>
              </div>

              <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Payments Today</span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">
                  ₹{stats.payments_today_amount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-300 mt-0.5 block">
                  {stats.payments_today_count} transaction{stats.payments_today_count === 1 ? '' : 's'}
                </span>
              </div>

              <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Active Officers Today</span>
                <span className="text-2xl font-black text-purple-300 mt-1 block">
                  {stats.active_officers_today}
                </span>
                <span className="text-[10px] text-slate-300 mt-0.5 block">Enforcing in field</span>
              </div>
            </div>
          </div>

          {/* Primary Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Registered Owners */}
            <div className="gov-card-interactive p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
                  Registered Owners
                </span>
                <div className="p-2.5 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA]">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black text-[#172033] dark:text-[#F1F5F9] tracking-tight">
                  {stats.total_owners > 0 ? stats.total_owners.toLocaleString('en-IN') : 'No data available'}
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] block mt-1">Verified vehicle owners</span>
              </div>
            </div>

            {/* Total Registered Vehicles */}
            <div className="gov-card-interactive p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
                  Registered Vehicles
                </span>
                <div className="p-2.5 rounded-xl bg-[#FFFBEB] dark:bg-[#451A03] text-[#D97706] dark:text-[#FBBF24]">
                  <Car className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black text-[#172033] dark:text-[#F1F5F9] tracking-tight">
                  {stats.total_vehicles > 0 ? stats.total_vehicles.toLocaleString('en-IN') : 'No data available'}
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] block mt-1">RTO synchronized database</span>
              </div>
            </div>

            {/* Total Officers */}
            <div className="gov-card-interactive p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
                  Traffic Officers
                </span>
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                  <Shield className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black text-[#172033] dark:text-[#F1F5F9] tracking-tight">
                  {stats.total_officers > 0 ? stats.total_officers.toLocaleString('en-IN') : 'No data available'}
                </span>
                <span className="text-xs text-[#16856B] dark:text-[#34D399] font-semibold block mt-1">
                  {stats.active_officers} Active on Duty
                </span>
              </div>
            </div>

            {/* Total Challans */}
            <div className="gov-card-interactive p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
                  Total Challans
                </span>
                <div className="p-2.5 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA]">
                  <FileCheck2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black text-[#172033] dark:text-[#F1F5F9] tracking-tight">
                  {stats.total_challans > 0 ? stats.total_challans.toLocaleString('en-IN') : 'No data available'}
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] block mt-1">Lifetime issued challans</span>
              </div>
            </div>
          </div>

          {/* Secondary Financial & Status Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Unpaid Challans */}
            <div className="gov-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
                  Unpaid Challans
                </span>
                <div className="p-2.5 rounded-xl bg-[#FFFBEB] dark:bg-[#451A03] text-[#D97706] dark:text-[#FBBF24] font-bold">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-[#D97706] dark:text-[#FBBF24]">
                  {stats.unpaid_challans.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] block mt-1">Awaiting citizen settlement</span>
              </div>
            </div>

            {/* Paid Challans */}
            <div className="gov-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
                  Paid Challans
                </span>
                <div className="p-2.5 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#16856B] dark:text-[#34D399] font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-[#16856B] dark:text-[#34D399]">
                  {stats.paid_challans.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] block mt-1">Successfully cleared</span>
              </div>
            </div>

            {/* Overdue Challans */}
            <div className="gov-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
                  Overdue Challans
                </span>
                <div className="p-2.5 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 text-[#DC2626] dark:text-[#F87171] font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-[#DC2626] dark:text-[#F87171]">
                  {stats.overdue_challans.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-[#DC2626] dark:text-[#F87171]/80 block mt-1">&gt; 30 Days past grace period</span>
              </div>
            </div>

            {/* Total Fine & Collected Amount */}
            <div className="gov-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
                  Total Collected
                </span>
                <div className="p-2.5 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#16856B] dark:text-[#34D399] font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-[#16856B] dark:text-[#34D399]">
                  ₹{stats.total_collected_amount.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] block mt-1">
                  Of ₹{stats.total_fine_amount.toLocaleString('en-IN')} total assessed fines
                </span>
              </div>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/admin/officers"
              className="gov-card-interactive p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] group-hover:text-[#174EA6] dark:group-hover:text-[#3B82F6] transition">
                    Officer Management
                  </h4>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Create, deploy & track officers</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#172033] dark:group-hover:text-[#F1F5F9]" />
            </Link>

            <Link
              to="/admin/challans"
              className="gov-card-interactive p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA] flex items-center justify-center font-bold">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] group-hover:text-[#174EA6] dark:group-hover:text-[#3B82F6] transition">
                    Inspect Challans
                  </h4>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Filter, search & resolve disputes</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#172033] dark:group-hover:text-[#F1F5F9]" />
            </Link>

            <Link
              to="/admin/analytics"
              className="gov-card-interactive p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#16856B] dark:text-[#34D399] flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] group-hover:text-[#174EA6] dark:group-hover:text-[#3B82F6] transition">
                    Violation Trends
                  </h4>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Analyze patterns & timeframes</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#172033] dark:group-hover:text-[#F1F5F9]" />
            </Link>

            <Link
              to="/admin/reports"
              className="gov-card-interactive p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] dark:bg-[#451A03] text-[#D97706] dark:text-[#FBBF24] flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] group-hover:text-[#174EA6] dark:group-hover:text-[#3B82F6] transition">
                    Generate Reports
                  </h4>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Export official CSV files</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#172033] dark:group-hover:text-[#F1F5F9]" />
            </Link>
          </div>

          {/* Recent Audit & System Activity */}
          <div className="gov-card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F0] dark:border-[#1E293B]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
                <h3 className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wide">
                  Recent Supervisory Audit Trail
                </h3>
              </div>
              <Link
                to="/admin/audit-logs"
                className="text-xs font-bold text-[#174EA6] dark:text-[#3B82F6] hover:underline flex items-center gap-1"
              >
                <span>View Full Audit Logs</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {stats.recent_activity.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-6 text-center">No recent audit logs available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F7F9FC] dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8] uppercase font-semibold border-b border-[#E2E8F0] dark:border-[#1E293B]">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Actor / Admin</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Target Resource</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
                    {stats.recent_activity.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F7F9FC] dark:hover:bg-[#162238]/60 transition font-mono text-[11px]">
                        <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-[#172033] dark:text-[#F1F5F9] font-semibold">{log.user_email}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-[#F7F9FC] dark:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] font-bold border border-[#E2E8F0] dark:border-[#1E293B]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8]">{log.target}</td>
                        <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8] max-w-xs truncate">{log.details}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SUCCESS'
                                ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#16856B] dark:text-[#34D399] border border-[#A7F3D0] dark:border-[#059669]/40'
                                : 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 text-[#DC2626] dark:text-[#F87171] border border-[#FECACA] dark:border-[#DC2626]/40'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
};
