import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  CheckCircle,
  AlertCircle,
  Eye,
  Camera,
  Image as ImageIcon,
  Zap,
  Shield,
  Layers,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../services/api';
import { AdminAIMonitoring as AdminAIMonitoringType } from '../../types';

export const AdminAIMonitoring: React.FC = () => {
  const [data, setData] = useState<AdminAIMonitoringType | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAIMonitoring = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getAdminAIMonitoring();
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch AI monitoring statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIMonitoring();
  }, []);

  return (
    <AdminLayout
      title="Computer Vision & AI Detection Monitoring"
      subtitle="Supervise YOLOv8 Violation Inference Pipeline, ANPR Optical Character Recognition & Model Confidence Telemetry"
    >
      {/* Top AI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Total AI Detections
            </span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <span className="text-3xl font-black text-slate-900 dark:text-slate-100 block mt-2">
            {data?.total_detections || 0}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Indexed in database</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Average Confidence
            </span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block mt-2">
            {data ? `${Math.round(data.average_confidence * 100)}%` : 'No data'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Bounding box & plate score</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Inference Engine
            </span>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <span className="text-base font-bold text-slate-900 dark:text-slate-100 block mt-2">
            YOLOv8 + Open-LPR
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
            Microservice Healthy (:8001)
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              High Confidence Ratio
            </span>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <span className="text-3xl font-black text-amber-600 dark:text-amber-400 block mt-2">
            {data?.confidence_distribution?.high || 0}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">&gt;= 90% Confidence detections</span>
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
          <span>Analyzing AI violation detection data...</span>
        </div>
      ) : !data || data.total_detections === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
          <p>No data available</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Breakdown by AI Detected Offense */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-2">
                Offenses Captured by Automated Vision Pipeline
              </h3>
              <div className="space-y-3">
                {data.violation_breakdown.map((item) => (
                  <div key={item.violation} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{item.violation}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {item.count} detections
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-2">
                Confidence Distribution Spectrum
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">High Confidence (&gt;= 90%)</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">{data.confidence_distribution.high} records</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${Math.round(
                          (data.confidence_distribution.high / Math.max(1, data.total_detections)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-amber-700 dark:text-amber-400">Medium Confidence (75% - 89%)</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">{data.confidence_distribution.medium} records</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${Math.round(
                          (data.confidence_distribution.medium / Math.max(1, data.total_detections)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-rose-700 dark:text-rose-400">Low Confidence (&lt; 75%)</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">{data.confidence_distribution.low} records</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{
                        width: `${Math.round(
                          (data.confidence_distribution.low / Math.max(1, data.total_detections)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent AI Detections Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Recent AI Captured Detections
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Plate Number</th>
                    <th className="py-3 px-4">Violation Detected</th>
                    <th className="py-3 px-4">Confidence Score</th>
                    <th className="py-3 px-4">Fine Amount</th>
                    <th className="py-3 px-4">Captured Timestamp</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-right">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                  {data.recent_detections.map((det) => (
                    <tr key={det.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-slate-100">{det.vehicle_plate}</td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">{det.violation}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                          {det.confidence !== null ? `${Math.round(det.confidence * 100)}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-black">₹{det.fine_amount}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {det.datetime ? new Date(det.datetime).toLocaleString('en-IN') : 'N/A'}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400">{det.location || 'N/A'}</td>
                      <td className="py-3 px-4 text-right">
                        {det.has_evidence ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-sans font-bold text-blue-600 dark:text-blue-400">
                            <ImageIcon className="w-3.5 h-3.5" /> Stored
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-sans">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
