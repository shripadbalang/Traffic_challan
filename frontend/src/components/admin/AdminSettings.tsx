import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle,
  AlertCircle,
  Building2,
  Clock,
  Cpu,
  Mail,
  ShieldCheck,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../services/api';

export const AdminSettings: React.FC = () => {
  const [settingsList, setSettingsList] = useState<any[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await api.getAdminSettings();
      setSettingsList(list);
      const initialMap: Record<string, string> = {};
      list.forEach((item: any) => {
        initialMap[item.key] = item.value;
      });
      setFormData(initialMap);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch system settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.updateAdminSettings(formData);
      setSuccessMsg('System settings have been successfully updated in database and logged.');
      fetchSettings();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update system settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="System Configuration & Policies"
      subtitle="Supervisory Parameters, Enforcement Thresholds, Overdue Grace Windows & Gateway Integration"
    >
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-amber-500 rounded-full animate-spin" />
          <span>Loading configuration from system_settings...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Department Information Section */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Department Jurisdiction & Identity
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Official Department Name
                </label>
                <input
                  type="text"
                  value={formData['dept_name'] || ''}
                  onChange={(e) => handleChange('dept_name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Rendered on official receipts & summons.</p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  State Enforcement Jurisdiction
                </label>
                <input
                  type="text"
                  value={formData['state_jurisdiction'] || ''}
                  onChange={(e) => handleChange('state_jurisdiction', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Geographic jurisdiction for MV Act enforcement.</p>
              </div>
            </div>
          </div>

          {/* Challan & Overdue Policies */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Challan Aging & Repeat Violator Rules
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Fine Settlement Grace Period (Days)
                </label>
                <input
                  type="number"
                  min="7"
                  max="180"
                  value={formData['fine_grace_period_days'] || '30'}
                  onChange={(e) => handleChange('fine_grace_period_days', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Days before an unpaid challan is deemed overdue.</p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Repeat Offender Threshold (Challans)
                </label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={formData['repeat_violator_threshold'] || '3'}
                  onChange={(e) => handleChange('repeat_violator_threshold', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Unpaid challan threshold for field impound/action.</p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Automatic Overdue Escalation
                </label>
                <select
                  value={formData['auto_escalate_overdue'] || 'true'}
                  onChange={(e) => handleChange('auto_escalate_overdue', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="true">ENABLED (Auto-mark overdue)</option>
                  <option value="false">DISABLED (Manual review only)</option>
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Escalates to court summons after grace period.</p>
              </div>
            </div>
          </div>

          {/* AI & ANPR Vision Thresholds */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Cpu className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Computer Vision & ANPR Confidence Gates
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Minimum ANPR Confidence Threshold
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.50"
                  max="0.99"
                  value={formData['anpr_confidence_threshold'] || '0.85'}
                  onChange={(e) => handleChange('anpr_confidence_threshold', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono text-slate-900 dark:text-slate-100"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Detections below this score require human officer manual review.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Payment Gateway Integration Mode
                </label>
                <select
                  value={formData['payment_gateway_mode'] || 'TEST'}
                  onChange={(e) => handleChange('payment_gateway_mode', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold font-mono text-slate-900 dark:text-slate-100"
                >
                  <option value="TEST">TEST (Sandbox Razorpay / Mock verification)</option>
                  <option value="LIVE">LIVE (Production MahaTreasury Gateway)</option>
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Switches between live banking and test mode.</p>
              </div>
            </div>
          </div>

          {/* Notification Gateway Toggles */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Citizen Communication Channels
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">SMS Notification Gateway</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dispatches instant SMS notices on challan issuance
                  </span>
                </div>
                <select
                  value={formData['sms_notifications_enabled'] || 'true'}
                  onChange={(e) => handleChange('sms_notifications_enabled', e.target.value)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">Email Notice Gateway</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sends electronic challan PDFs and receipts to verified emails
                  </span>
                </div>
                <select
                  value={formData['email_notifications_enabled'] || 'true'}
                  onChange={(e) => handleChange('email_notifications_enabled', e.target.value)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>{saving ? 'Saving System Policies...' : 'Save Configuration Changes'}</span>
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
};
