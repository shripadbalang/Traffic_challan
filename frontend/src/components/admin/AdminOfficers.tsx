import React, { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Mail,
  Award,
  AlertCircle,
  UserCheck,
  UserX,
  X,
  FileCheck2,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../services/api';
import { AdminOfficer } from '../../types';

export const AdminOfficers: React.FC = () => {
  const [officers, setOfficers] = useState<AdminOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState<AdminOfficer | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [officerDetail, setOfficerDetail] = useState<any | null>(null);

  // Form states for creating officer
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    badge_number: '',
    station: 'Pune City Traffic Division',
    jurisdiction: 'Zone 1 (Shivajinagar - Deccan)',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Form states for editing officer
  const [editForm, setEditForm] = useState({
    station: '',
    jurisdiction: '',
    is_active: true,
    password: '',
  });

  const fetchOfficers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getAdminOfficers(search || undefined);
      setOfficers(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch officers list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficers();
  }, [search]);

  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.createAdminOfficer(createForm);
      setSuccessMsg(`Officer ${createForm.full_name} (${createForm.badge_number}) registered successfully.`);
      setCreateModalOpen(false);
      setCreateForm({
        full_name: '',
        email: '',
        badge_number: '',
        station: 'Pune City Traffic Division',
        jurisdiction: 'Zone 1 (Shivajinagar - Deccan)',
        password: '',
      });
      fetchOfficers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create officer account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (officer: AdminOfficer) => {
    setSelectedOfficer(officer);
    setEditForm({
      station: officer.station,
      jurisdiction: officer.jurisdiction,
      is_active: officer.is_active,
      password: '',
    });
    setEditModalOpen(true);
  };

  const handleUpdateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficer) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.updateAdminOfficer(selectedOfficer.id, {
        station: editForm.station,
        jurisdiction: editForm.jurisdiction,
        is_active: editForm.is_active,
        password: editForm.password || undefined,
      });

      setSuccessMsg(`Officer ${selectedOfficer.badge_number} updated successfully.`);
      setEditModalOpen(false);
      fetchOfficers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update officer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (officer: AdminOfficer) => {
    try {
      await api.updateAdminOfficer(officer.id, {
        is_active: !officer.is_active,
      });
      setSuccessMsg(
        `Officer ${officer.badge_number} marked as ${!officer.is_active ? 'ACTIVE' : 'INACTIVE'}.`
      );
      fetchOfficers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change officer status.');
    }
  };

  const handleViewDetail = async (officer: AdminOfficer) => {
    setSelectedOfficer(officer);
    setDetailModalOpen(true);
    try {
      const detail = await api.getAdminOfficerDetail(officer.id);
      setOfficerDetail(detail);
    } catch {
      setOfficerDetail(null);
    }
  };

  return (
    <AdminLayout
      title="Traffic Officer Management"
      subtitle="Supervise Field Traffic Officers, Assign Stations, Track Activity & Authorize Accounts"
    >
      {/* Top Banner Actions & Alerts */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 gov-card p-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by badge number, officer name, email, station..."
            className="gov-input pl-9 text-xs"
          />
          <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
        </div>

        {/* Add Officer Button */}
        <button
          onClick={() => setCreateModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2 text-xs py-2.5 px-4"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Traffic Officer</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/30 border border-[#A7F3D0] dark:border-[#059669]/40 text-[#16856B] dark:text-[#34D399] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#16856B] dark:text-[#34D399] hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 text-[#DC2626] dark:text-[#F87171] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#F87171] flex-shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-[#DC2626] dark:text-[#F87171] hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Officers Table */}
      <div className="gov-card overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#174EA6] dark:text-[#3B82F6]" />
            <h3 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wide">
              Official Department Officers ({officers.length})
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#64748B] dark:text-[#94A3B8] text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#174EA6] dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            <span>Loading registered officers...</span>
          </div>
        ) : officers.length === 0 ? (
          <div className="py-16 text-center text-[#64748B] dark:text-[#94A3B8] text-xs">
            <p>No data available matching your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F7F9FC] dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold text-[11px] border-b border-[#E2E8F0] dark:border-[#1E293B]">
                <tr>
                  <th className="py-3 px-4">Officer Profile</th>
                  <th className="py-3 px-4">Badge Number</th>
                  <th className="py-3 px-4">Station / Jurisdiction</th>
                  <th className="py-3 px-4">Enforcement Activity</th>
                  <th className="py-3 px-4">Today's Challans</th>
                  <th className="py-3 px-4">Duty Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#172033] dark:text-[#F1F5F9]">
                {officers.map((officer) => (
                  <tr key={officer.id} className="hover:bg-[#F7F9FC] dark:hover:bg-[#162238]/60 transition">
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-bold text-[#172033] dark:text-[#F1F5F9] block">{officer.full_name}</span>
                        <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" /> {officer.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-[#172033] dark:text-[#F1F5F9] bg-[#F7F9FC] dark:bg-[#162238] px-2.5 py-1 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
                        <Award className="w-3.5 h-3.5 text-[#D97706] dark:text-[#FBBF24]" />
                        {officer.badge_number}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-[#172033] dark:text-[#F1F5F9] block">{officer.station}</span>
                        <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#64748B] dark:text-[#94A3B8]" /> {officer.jurisdiction}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#172033] dark:text-[#F1F5F9] block">
                        {officer.challans_generated} challans issued
                      </span>
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Last active:{' '}
                        {officer.last_activity
                          ? new Date(officer.last_activity).toLocaleDateString('en-IN')
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                          officer.challans_today > 0
                            ? 'gov-badge-success'
                            : 'gov-badge-info'
                        }`}
                      >
                        {officer.challans_today} today
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          officer.is_active
                            ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#16856B] dark:text-[#34D399] border-[#A7F3D0] dark:border-[#059669]/40'
                            : 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 text-[#DC2626] dark:text-[#F87171] border-[#FECACA] dark:border-[#DC2626]/40'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            officer.is_active ? 'bg-[#16856B] dark:bg-[#34D399]' : 'bg-[#DC2626] dark:text-[#F87171]'
                          }`}
                        />
                        {officer.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetail(officer)}
                          className="btn-secondary py-1.5 px-2.5 text-xs"
                        >
                          Activity
                        </button>
                        <button
                          onClick={() => handleOpenEdit(officer)}
                          className="btn-secondary p-1.5"
                          title="Edit Station / Status"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(officer)}
                          className={`p-1.5 rounded-lg border transition ${
                            officer.is_active
                              ? 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 hover:bg-[#FEE2E2] text-[#DC2626] dark:text-[#F87171] border-[#FECACA] dark:border-[#DC2626]/40'
                              : 'bg-[#ECFDF5] dark:bg-[#064E3B]/30 hover:bg-[#D1FAE5] text-[#16856B] dark:text-[#34D399] border-[#A7F3D0] dark:border-[#059669]/40'
                          }`}
                          title={officer.is_active ? 'Deactivate Officer' : 'Activate Officer'}
                        >
                          {officer.is_active ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE OFFICER MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-[#1E293B] max-w-lg w-full p-6 space-y-4 text-[#172033] dark:text-[#F1F5F9]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA] flex items-center justify-center font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-[#172033] dark:text-[#F1F5F9]">Register New Traffic Officer</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOfficer} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#172033] dark:text-[#F1F5F9] font-bold mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspector Ramesh Patil"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  className="gov-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#172033] dark:text-[#F1F5F9] font-bold mb-1">
                    Badge Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MH-PUN-0045"
                    value={createForm.badge_number}
                    onChange={(e) => setCreateForm({ ...createForm, badge_number: e.target.value.toUpperCase() })}
                    className="gov-input font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[#172033] dark:text-[#F1F5F9] font-bold mb-1">
                    Official Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="officer@traffic.gov.in"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="gov-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#172033] dark:text-[#F1F5F9] font-bold mb-1">Station / Police Division</label>
                <input
                  type="text"
                  placeholder="e.g. Pune City Traffic Division"
                  value={createForm.station}
                  onChange={(e) => setCreateForm({ ...createForm, station: e.target.value })}
                  className="gov-input"
                />
              </div>

              <div>
                <label className="block text-[#172033] dark:text-[#F1F5F9] font-bold mb-1">Jurisdiction / Beat Area</label>
                <input
                  type="text"
                  placeholder="e.g. Zone 1 (Shivajinagar - Deccan)"
                  value={createForm.jurisdiction}
                  onChange={(e) => setCreateForm({ ...createForm, jurisdiction: e.target.value })}
                  className="gov-input"
                />
              </div>

              <div>
                <label className="block text-[#172033] dark:text-[#F1F5F9] font-bold mb-1">
                  Temporary Access Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="gov-input"
                />
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                  The officer will use this password to sign into the Officer Duty Console.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-secondary py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-2 px-4 flex items-center gap-1.5"
                >
                  {submitting ? 'Registering...' : 'Register Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT OFFICER MODAL */}
      {editModalOpen && selectedOfficer && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-[#1E293B] max-w-md w-full p-6 space-y-4 text-[#172033] dark:text-[#F1F5F9]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#172033] dark:text-[#F1F5F9]">Edit Officer Details</h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {selectedOfficer.full_name} ({selectedOfficer.badge_number})
                </p>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateOfficer} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#172033] dark:text-[#F1F5F9] font-bold mb-1">Station / Police Division</label>
                <input
                  type="text"
                  value={editForm.station}
                  onChange={(e) => setEditForm({ ...editForm, station: e.target.value })}
                  className="gov-input"
                />
              </div>

              <div>
                <label className="block text-[#172033] dark:text-[#F1F5F9] font-bold mb-1">Jurisdiction Area</label>
                <input
                  type="text"
                  value={editForm.jurisdiction}
                  onChange={(e) => setEditForm({ ...editForm, jurisdiction: e.target.value })}
                  className="gov-input"
                />
              </div>

              <div>
                <label className="block text-[#172033] dark:text-[#F1F5F9] font-bold mb-1">Reset Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep existing password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="gov-input"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="active-toggle"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#174EA6] rounded border-[#E2E8F0] dark:border-[#1E293B]"
                />
                <label htmlFor="active-toggle" className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">
                  Officer Active on Duty
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn-secondary py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-2 px-4 flex items-center gap-1.5"
                >
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICER DETAIL & ACTIVITY MODAL */}
      {detailModalOpen && selectedOfficer && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-[#1E293B] max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto text-[#172033] dark:text-[#F1F5F9]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#172033] dark:text-[#F1F5F9]">{selectedOfficer.full_name}</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
                    Badge: {selectedOfficer.badge_number} • {selectedOfficer.email}
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F7F9FC] dark:bg-[#162238]/60 p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] text-xs">
              <div>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block font-medium">Station</span>
                <span className="font-bold text-[#172033] dark:text-[#F1F5F9] block mt-0.5">{selectedOfficer.station}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block font-medium">Jurisdiction</span>
                <span className="font-bold text-[#172033] dark:text-[#F1F5F9] block mt-0.5">{selectedOfficer.jurisdiction}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block font-medium">Total Challans</span>
                <span className="font-bold text-[#172033] dark:text-[#F1F5F9] block mt-0.5">{selectedOfficer.challans_generated}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block font-medium">Status</span>
                <span className={`font-bold block mt-0.5 ${selectedOfficer.is_active ? 'text-[#16856B] dark:text-[#34D399]' : 'text-[#DC2626] dark:text-[#F87171]'}`}>
                  {selectedOfficer.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
                Recent Challans Generated by this Officer
              </h4>

              {!officerDetail || !officerDetail.recent_challans || officerDetail.recent_challans.length === 0 ? (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-4 text-center">No recent challans generated yet.</p>
              ) : (
                <div className="border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F7F9FC] dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8] uppercase font-semibold text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Plate</th>
                        <th className="py-2 px-3">Violation</th>
                        <th className="py-2 px-3">Fine</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#172033] dark:text-[#F1F5F9]">
                      {officerDetail.recent_challans.map((ch: any) => (
                        <tr key={ch.id} className="hover:bg-[#F7F9FC] dark:hover:bg-[#162238]/60 font-mono text-[11px]">
                          <td className="py-2 px-3 font-bold text-[#172033] dark:text-[#F1F5F9]">{ch.plate_number}</td>
                          <td className="py-2 px-3 font-sans text-[#172033] dark:text-[#F1F5F9]">{ch.violation}</td>
                          <td className="py-2 px-3 text-[#16856B] dark:text-[#34D399] font-bold">₹{ch.fine_amount}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#F7F9FC] dark:bg-[#162238] text-[#172033] dark:text-[#F1F5F9]">
                              {ch.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#64748B] dark:text-[#94A3B8]">
                            {ch.datetime ? new Date(ch.datetime).toLocaleDateString('en-IN') : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] flex justify-end">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="btn-secondary py-2 px-4 text-xs font-bold"
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
