import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, FileWarning, CheckCircle2, UserX } from 'lucide-react';
import { AnalyticsData } from '../../types';
import { Badge } from '../common/Badge';

export const RepeatOffenders: React.FC<{ offenders: AnalyticsData['repeatOffenders'] }> = ({
  offenders: initialOffenders,
}) => {
  const [offenders, setOffenders] = useState(initialOffenders);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleAction = (plate: string, action: string) => {
    setActionNotice(`Notice issued for ${plate}: ${action}`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            Repeat Offender Watchlist & High-Risk Profiling
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automated scoring of persistent traffic violators based on frequency, unpaid fines, and dangerous driving sections.
          </p>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-600/70 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
            <tr>
              <th className="py-3 px-4">Vehicle Plate</th>
              <th className="py-3 px-4">Registered Owner</th>
              <th className="py-3 px-4">Total Offenses</th>
              <th className="py-3 px-4">Unpaid Dues</th>
              <th className="py-3 px-4">Risk Index</th>
              <th className="py-3 px-4 text-right">Supervisory Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {offenders.map((offender) => (
              <tr key={offender.plateNumber} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                <td className="py-3.5 px-4">
                  <Badge variant="plate">{offender.plateNumber}</Badge>
                </td>
                <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-200">
                  {offender.ownerName}
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                  {offender.totalViolations} violations
                </td>
                <td className="py-3.5 px-4 font-bold text-rose-600 dark:text-rose-400">
                  ₹{offender.unpaidAmount.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={offender.riskLevel === 'CRITICAL' ? 'danger' : 'warning'}>
                      {offender.riskLevel} ({offender.riskScore}/100)
                    </Badge>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(offender.plateNumber, 'Official Legal Summons & RTO Warning Dispatched')
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-600/20 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-amber-800 dark:text-amber-300 font-semibold text-xs border border-amber-200 dark:border-amber-500/30 transition"
                    >
                      Issue Summons
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(offender.plateNumber, 'Recommendation for 3-Month License Suspension filed with RTO')
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-rose-800 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-500/30 transition"
                    >
                      Suspend DL
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
