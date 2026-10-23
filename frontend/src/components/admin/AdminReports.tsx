import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  FileCheck2,
  DollarSign,
  Shield,
  Car,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api, apiFetch } from '../../services/api';

export const AdminReports: React.FC = () => {
  const [reportType, setReportType] = useState('challans');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getAdminReports(reportType, {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        status_filter: statusFilter,
      });
      setReportData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, statusFilter]);

  const handleDownloadCsv = () => {
    const query = new URLSearchParams();
    query.set('report_type', reportType);
    if (fromDate) query.set('from_date', fromDate);
    if (toDate) query.set('to_date', toDate);
    if (statusFilter && statusFilter !== 'ALL') query.set('status_filter', statusFilter);

    const token = localStorage.getItem('auth_token');
    const exportUrl = `/admin/reports/export?${query.toString()}`;

    // Trigger download with auth token in fetch or anchor
    apiFetch(exportUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mahatraffic_${reportType}_report.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch((err) => {
        setErrorMsg('Failed to download CSV: ' + err.message);
      });
  };

  return (
    <AdminLayout
      title="Department Reports & CSV Data Export"
      subtitle="Export Structured Audit & Administrative Records directly from Supabase PostgreSQL"
    >
      {/* Report Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'challans', label: 'Challan Records', icon: FileCheck2 },
          { id: 'payments', label: 'Treasury Payments', icon: DollarSign },
          { id: 'officers', label: 'Officer Performance', icon: Shield },
          { id: 'vehicles', label: 'Vehicle Violations', icon: Car },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                isActive
                  ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-800 dark:border-blue-500 shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <span className="font-bold text-xs">{tab.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter and Download Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="font-semibold text-slate-600 dark:text-slate-400">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600 dark:text-slate-400">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          {reportType === 'challans' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="disputed">Disputed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}

          <button
            onClick={fetchReport}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-300 rounded-lg text-xs transition"
          >
            Apply Filters
          </button>
        </div>

        {/* Export CSV button */}
        <button
          onClick={handleDownloadCsv}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
        >
          <Download className="w-4 h-4" />
          <span>Export {reportType.toUpperCase()} to CSV</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Preview Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Report Preview ({reportData?.count || 0} Records)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Live records from database</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-amber-500 rounded-full animate-spin" />
            <span>Compiling report...</span>
          </div>
        ) : !reportData || reportData.rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
            <p>No data available matching your filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] sticky top-0 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {Object.keys(reportData.rows[0]).map((key) => (
                    <th key={key} className="py-2.5 px-3 whitespace-nowrap">
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                {reportData.rows.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {Object.values(row).map((val: any, colIdx: number) => (
                      <td key={colIdx} className="py-2.5 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                        {String(val ?? 'N/A')}
                      </td>
                    ))}
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
