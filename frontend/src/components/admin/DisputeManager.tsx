import React, { useState } from 'react';
import { Check, X, Eye, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Challan } from '../../types';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { EvidenceViewer } from '../citizen/EvidenceViewer';

export const DisputeManager: React.FC<{
  disputedChallans: Challan[];
  onDisputeResolved: (challan: Challan) => void;
}> = ({ disputedChallans, onDisputeResolved }) => {
  const [selectedForEvidence, setSelectedForEvidence] = useState<Challan | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (challanId: string, approve: boolean) => {
    setResolvingId(challanId);
    try {
      const updated = await api.resolveDispute(challanId, approve);
      onDisputeResolved(updated);
    } catch {
      alert('Failed to update dispute status.');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4 p-6">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Citizen Dispute & Grievance Adjudication Desk
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Supervisory review of contested citations, AI detection claims, and photographic evidence.
        </p>
      </div>

      {disputedChallans.length === 0 ? (
        <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400 mx-auto" />
          <h4 className="font-semibold text-slate-700 dark:text-slate-200">No Pending Disputes</h4>
          <p className="text-xs text-slate-400 dark:text-slate-500">All citizen grievances have been reviewed and adjudicated.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {disputedChallans.map((challan) => (
            <div key={challan.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{challan.id}</span>
                  <Badge variant="plate">{challan.vehiclePlate}</Badge>
                  <span className="text-slate-500 dark:text-slate-400">• Fine: ₹{challan.fineAmount}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">• Violation: {challan.violation}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[11px] mb-0.5">
                    Citizen Grievance Submission:
                  </span>
                  <p className="italic">
                    "{challan.disputeReason || 'Citizen contested: Claimed false positive detection.'}"
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => setSelectedForEvidence(challan)}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Eye className="w-4 h-4 text-blue-500 dark:text-blue-400" /> Inspect Evidence
                </button>

                <button
                  type="button"
                  disabled={resolvingId === challan.id}
                  onClick={() => handleResolve(challan.id, true)}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Approve (Dismiss)
                </button>

                <button
                  type="button"
                  disabled={resolvingId === challan.id}
                  onClick={() => handleResolve(challan.id, false)}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Reject (Uphold)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EvidenceViewer
        isOpen={!!selectedForEvidence}
        onClose={() => setSelectedForEvidence(null)}
        challan={selectedForEvidence}
      />
    </div>
  );
};
