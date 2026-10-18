import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Filter,
  TrendingUp,
  Cpu,
  User,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PieChart,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../services/api';

export const AdminAnalytics: React.FC = () => {
  const [timeFilter, setTimeFilter] = useState<'today' | '7d' | '30d' | 'year' | 'custom'>('30d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getAdminViolationAnalytics({
        time_filter: timeFilter,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch violation analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  const handleApplyCustomDate = () => {
    if (fromDate) {
      setTimeFilter('custom');
      fetchAnalytics();
    }
  };

  const totalViolations = data?.total_challans || 0;

  return (
    <AdminLayout
      title="Traffic Violation Analytics"
      subtitle="Statistical Breakdown of Detected Traffic Offenses, Time Trend Analysis & Modality Disaggregation"
    >
      {/* Time Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Time Filter:
          </span>
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'year', label: 'This Year' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                timeFilter === tab.id
                  ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
          />
          <span className="text-slate-400 dark:text-slate-500">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
          />
          <button
            onClick={handleApplyCustomDate}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition"
          >
            Apply
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-amber-500 rounded-full animate-spin" />
          <span>Computing violation metrics from database...</span>
        </div>
      ) : !data || totalViolations === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
          <p>No data available for the selected timeframe.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Total Violations in Period
              </span>
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100 block mt-2">
                {totalViolations.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">Assessed across all divisions</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                AI Detection Share
              </span>
              <span className="text-3xl font-black text-blue-600 dark:text-blue-400 block mt-2">
                {Math.round(((data.source_breakdown?.ai || 0) / totalViolations) * 100)}%
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">
                {data.source_breakdown?.ai || 0} AI detections vs {data.source_breakdown?.manual || 0} manual
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Total Fine Assessment
              </span>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block mt-2">
                ₹
                {data.violation_breakdown
                  ?.reduce((sum: number, v: any) => sum + v.fine_total, 0)
                  ?.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">Cumulative fine assessment</span>
            </div>
          </div>

          {/* Clean Violation Distribution Bars */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  Violation Frequency by Classification
                </h3>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">Actual DB records</span>
            </div>

            <div className="space-y-4">
              {data.violation_breakdown.map((item: any) => {
                const percentage = totalViolations > 0 ? (item.count / totalViolations) * 100 : 0;
                return (
                  <div key={item.code} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {item.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{item.count} counts</span>
                        <span className="text-slate-400 dark:text-slate-500">({Math.round(percentage)}%)</span>
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          ₹{item.fine_total.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Clean Progress Bar */}
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Trend Table / Timeline */}
          {data.daily_trend && data.daily_trend.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    Daily Enforcement Timeline
                  </h3>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">Time series distribution</span>
              </div>

              <div className="flex items-end gap-2 h-40 pt-4 px-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2">
                {data.daily_trend.map((d: any) => {
                  const maxDayCount = Math.max(1, ...data.daily_trend.map((x: any) => x.count));
                  const heightPercent = Math.max(15, (d.count / maxDayCount) * 100);
                  return (
                    <div
                      key={d.date}
                      className="flex-1 min-w-[36px] flex flex-col items-center justify-end h-full group"
                    >
                      <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition mb-1">
                        {d.count}
                      </span>
                      <div
                        className="w-full bg-amber-500 hover:bg-amber-600 rounded-t-md transition-all"
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
};
