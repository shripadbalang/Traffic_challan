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
  IndianRupee,
  AlertTriangle,
  Trash2,
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

  // Dedicated Fine Rates State
  const [fineRates, setFineRates] = useState<{
    fine_helmet: number;
    fine_triple_riding: number;
    fine_wrong_side: number;
    fine_all_three_combined: number;
  }>({
    fine_helmet: 500,
    fine_triple_riding: 1000,
    fine_wrong_side: 1500,
    fine_all_three_combined: 2000,
  });
  const [fineSaving, setFineSaving] = useState(false);
  const [fineError, setFineError] = useState<string | null>(null);
  const [fineSuccess, setFineSuccess] = useState<string | null>(null);

  // History Reset State
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

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

      // Fetch Fine Settings
      try {
        const fines = await api.getAdminFineSettings();
        if (fines) {
          setFineRates({
            fine_helmet: fines.fine_helmet ?? 500,
            fine_triple_riding: fines.fine_triple_riding ?? 1000,
            fine_wrong_side: fines.fine_wrong_side ?? 1500,
            fine_all_three_combined: fines.fine_all_three_combined ?? 2000,
          });
        }
      } catch (fErr: any) {
        console.warn('Could not load specific fine settings, using defaults:', fErr);
      }
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

  const handleFineChange = (key: keyof typeof fineRates, valStr: string) => {
    const val = parseInt(valStr, 10);
    setFineRates((prev) => ({
      ...prev,
      [key]: isNaN(val) ? 0 : Math.max(0, val),
    }));
  };

  const handleSaveFines = async (e: React.FormEvent) => {
    e.preventDefault();
    setFineSaving(true);
    setFineError(null);
    setFineSuccess(null);

    // Validation
    if (
      fineRates.fine_helmet < 0 ||
      fineRates.fine_triple_riding < 0 ||
      fineRates.fine_wrong_side < 0 ||
      fineRates.fine_all_three_combined < 0
    ) {
      setFineError('Fine rates must be positive whole numbers (non-negative rupees).');
      setFineSaving(false);
      return;
    }

    try {
      await api.updateAdminFineSettings(fineRates);
      setFineSuccess(
        'Fine rates successfully saved to database. Updated amounts will apply to newly generated challans.'
      );
    } catch (err: any) {
      setFineError(err.message || 'Failed to update fine settings.');
    } finally {
      setFineSaving(false);
    }
  };

  const handleResetHistory = async () => {
    if (resetConfirmInput !== 'RESET_ALL_CHALLANS') {
      setResetError('Please type RESET_ALL_CHALLANS exactly to confirm.');
      return;
    }

    setResetting(true);
    setResetError(null);
    setResetMsg(null);

    try {
      const res = await api.resetChallanHistory();
      setResetMsg(res.message || 'Challan history successfully reset to 0.');
      setShowResetModal(false);
      setResetConfirmInput('');
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset challan history.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <AdminLayout
      title="System Configuration & Policies"
      subtitle="Supervisory Parameters, Enforcement Fine Rates, Grace Windows & Data Controls"
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
        <div className="space-y-8">
          {/* ============================================================ */}
          {/* 1. CHALLAN FINE SETTINGS SECTION                             */}
          {/* ============================================================ */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    Challan Fine Rates & Statutory Penalty Settings
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Statutory fine amounts enforced under the Motor Vehicles Act, 1988.
                  </p>
                </div>
              </div>
            </div>

            {fineError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{fineError}</span>
              </div>
            )}

            {fineSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{fineSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveFines} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Helmet Fine */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800 dark:text-slate-200">
                      Helmet Violation
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Sec 129</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={fineRates.fine_helmet}
                      onChange={(e) => handleFineChange('fine_helmet', e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Riding without protective headgear</p>
                </div>

                {/* Triple Riding Fine */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800 dark:text-slate-200">
                      Triple Riding
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Sec 128</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={fineRates.fine_triple_riding}
                      onChange={(e) => handleFineChange('fine_triple_riding', e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">More than 2 riders on two-wheeler</p>
                </div>

                {/* Wrong-Side Driving Fine */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-800 dark:text-slate-200">
                      Wrong-Side Driving
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Sec 119/177</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={fineRates.fine_wrong_side}
                      onChange={(e) => handleFineChange('fine_wrong_side', e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Contravention of mandatory traffic direction</p>
                </div>

                {/* Special 3-Violation Combined Package */}
                <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-amber-950 dark:text-amber-200">
                      Combined Package (All 3)
                    </label>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">Special</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-amber-600 dark:text-amber-400 font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={fineRates.fine_all_three_combined}
                      onChange={(e) => handleFineChange('fine_all_three_combined', e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-amber-800 dark:text-amber-300">Special combined concession for all 3 offenses</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  Note: Rate modifications apply strictly to newly generated challans. Previously issued challans retain their recorded fine amounts.
                </p>
                <button
                  type="submit"
                  disabled={fineSaving}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow transition disabled:opacity-50 shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>{fineSaving ? 'Saving Rates...' : 'Save Fine Rates'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* ============================================================ */}
          {/* 2. GENERAL POLICIES & DEPARTMENT SETTINGS                     */}
          {/* ============================================================ */}
          <form onSubmit={handleSave} className="space-y-6">
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
                    Enforcement Jurisdiction Authority
                  </label>
                  <input
                    type="text"
                    value={formData['department_name'] || 'Maharashtra State Traffic Police'}
                    onChange={(e) => handleChange('department_name', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Appears on official challans, receipts, and court summons.</p>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Helpdesk Support Email
                  </label>
                  <input
                    type="email"
                    value={formData['support_email'] || 'support@echallan.gov.in'}
                    onChange={(e) => handleChange('support_email', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Contact email displayed to citizens on challan notices.</p>
                </div>
              </div>
            </div>

            {/* Overdue Policies */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  Fine Settlement & Overdue Parameters
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Statutory Payment Grace Period (Days)
                  </label>
                  <input
                    type="number"
                    min="7"
                    max="90"
                    value={formData['fine_grace_period_days'] || '30'}
                    onChange={(e) => handleChange('fine_grace_period_days', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Standard duration before a challan is officially flagged overdue.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Late Payment Surcharge / Penalty (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={formData['late_penalty_percentage'] || '10'}
                    onChange={(e) => handleChange('late_penalty_percentage', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Additional percentage applied if unpaid beyond grace period.</p>
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

            {/* Save Button for General Settings */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-amber-400" />
                <span>{saving ? 'Saving System Policies...' : 'Save General Policies'}</span>
              </button>
            </div>
          </form>

          {/* ============================================================ */}
          {/* 3. DANGER ZONE: DEMO CHALLAN HISTORY RESET                   */}
          {/* ============================================================ */}
          <div className="bg-rose-50/50 dark:bg-rose-950/20 p-6 rounded-2xl border border-rose-200 dark:border-rose-900 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-rose-200 dark:border-rose-900/60 pb-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <h3 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                Demo Data & Challan History Reset Control
              </h3>
            </div>

            <p className="text-xs text-rose-800 dark:text-rose-300">
              Clear all demo/test challan records so the dashboard displays <strong>0 challans</strong> for the initial live state.
              This operation strictly preserves all registered vehicles, citizen/owner accounts, officer profiles, and system settings.
            </p>

            {resetMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{resetMsg}</span>
              </div>
            )}

            {resetError && (
              <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {!showResetModal ? (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Reset Challan History to 0</span>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-rose-300 dark:border-rose-800 space-y-3">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Confirmation Required: Please type <span className="font-mono text-rose-600 bg-rose-50 dark:bg-rose-950 px-1 py-0.5 rounded">RESET_ALL_CHALLANS</span> to confirm.
                </p>
                <input
                  type="text"
                  placeholder="RESET_ALL_CHALLANS"
                  value={resetConfirmInput}
                  onChange={(e) => setResetConfirmInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetConfirmInput('');
                      setResetError(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={resetting || resetConfirmInput !== 'RESET_ALL_CHALLANS'}
                    onClick={handleResetHistory}
                    className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-40"
                  >
                    {resetting ? 'Resetting...' : 'Confirm Reset (Delete Test Challans)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
