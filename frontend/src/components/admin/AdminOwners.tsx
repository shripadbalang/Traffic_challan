import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Car,
  FileText,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  X,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api, cleanMobile10 } from '../../services/api';
import { AdminOwner } from '../../types';

export const AdminOwners: React.FC = () => {
  const [owners, setOwners] = useState<AdminOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Detail Modal
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [ownerDetail, setOwnerDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchOwners = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getAdminOwners(search || undefined);
      setOwners(res.items || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch registered owners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOwners();
  }, [search]);

  const handleInspectOwner = async (ownerId: string) => {
    setSelectedOwnerId(ownerId);
    setDetailLoading(true);
    try {
      const detail = await api.getAdminOwnerDetail(ownerId);
      setOwnerDetail(detail);
    } catch {
      setOwnerDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Registered Vehicle Owners"
      subtitle="Citizen Portal Registry, Linked Registered Vehicles & Payment Compliance"
    >
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 gov-card p-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by owner name, registered mobile, email..."
            className="gov-input pl-9 text-xs"
          />
          <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
        </div>
        <div className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
          Total Registered Owners: <strong className="text-[#172033] dark:text-[#F1F5F9]">{owners.length}</strong>
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 text-[#DC2626] dark:text-[#F87171] text-xs">
          {errorMsg}
        </div>
      )}

      {/* Owners Table */}
      <div className="gov-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[#64748B] dark:text-[#94A3B8] text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#174EA6] dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            <span>Loading registered owners...</span>
          </div>
        ) : owners.length === 0 ? (
          <div className="py-16 text-center text-[#64748B] dark:text-[#94A3B8] text-xs">
            <p>No data available matching your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F7F9FC] dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold text-[11px] border-b border-[#E2E8F0] dark:border-[#1E293B]">
                <tr>
                  <th className="py-3 px-4">Owner Name</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4">Vehicles</th>
                  <th className="py-3 px-4">Challans (Unpaid)</th>
                  <th className="py-3 px-4">Assessed Fines</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#172033] dark:text-[#F1F5F9]">
                {owners.map((owner) => (
                  <tr key={owner.id} className="hover:bg-[#F7F9FC] dark:hover:bg-[#162238]/60 transition">
                    <td className="py-3 px-4 font-bold text-[#172033] dark:text-[#F1F5F9]">{owner.full_name}</td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="text-[#172033] dark:text-[#F1F5F9] flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-[#64748B] dark:text-[#94A3B8]" />
                          {owner.mobile_number ? `+91 ${cleanMobile10(owner.mobile_number)}` : 'N/A'}
                        </span>
                        <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-[#64748B] dark:text-[#94A3B8]" /> {owner.email || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          owner.is_verified
                            ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#16856B] dark:text-[#34D399] border border-[#A7F3D0] dark:border-[#059669]/40'
                            : 'bg-[#FFFBEB] dark:bg-[#451A03] text-[#D97706] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#78350F]'
                        }`}
                      >
                        {owner.is_verified ? (
                          <>
                            <CheckCircle className="w-3 h-3" /> Verified
                          </>
                        ) : (
                          'Pending OTP'
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#64748B] dark:text-[#94A3B8]">
                      {owner.created_at ? new Date(owner.created_at).toLocaleDateString('en-IN') : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F7F9FC] dark:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] font-bold border border-[#E2E8F0] dark:border-[#1E293B]">
                        <Car className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                        {owner.linked_vehicles_count} vehicle{owner.linked_vehicles_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#172033] dark:text-[#F1F5F9]">{owner.total_challans} total</span>
                      {owner.unpaid_challans > 0 && (
                        <span className="block text-[11px] text-[#D97706] dark:text-[#FBBF24] font-semibold">
                          ({owner.unpaid_challans} unpaid)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#172033] dark:text-[#F1F5F9]">
                      ₹{owner.total_fines.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleInspectOwner(owner.id)}
                        className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INSPECT OWNER MODAL */}
      {selectedOwnerId && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-[#1E293B] max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto text-[#172033] dark:text-[#F1F5F9]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA] flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#172033] dark:text-[#F1F5F9]">
                    {ownerDetail?.full_name || 'Loading Owner Profile...'}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Citizen & Vehicle Owner Portfolio</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOwnerId(null)}
                className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading || !ownerDetail ? (
              <div className="py-12 text-center text-[#64748B] dark:text-[#94A3B8] text-xs">
                <span>Loading profile details...</span>
              </div>
            ) : (
              <>
                {/* Profile Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F7F9FC] dark:bg-[#162238]/60 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] text-xs">
                  <div>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block font-medium">Registered Mobile</span>
                    <span className="font-bold text-[#172033] dark:text-[#F1F5F9] font-mono block mt-0.5">
                      {ownerDetail.mobile_number ? `+91 ${cleanMobile10(ownerDetail.mobile_number)}` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block font-medium">Registered Email</span>
                    <span className="font-bold text-[#172033] dark:text-[#F1F5F9] block mt-0.5 truncate">{ownerDetail.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block font-medium">Verification Status</span>
                    <span className="font-bold text-[#16856B] dark:text-[#34D399] block mt-0.5">
                      {ownerDetail.is_verified ? 'Verified Citizen' : 'Unverified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block font-medium">Registration Date</span>
                    <span className="font-bold text-[#172033] dark:text-[#F1F5F9] block mt-0.5">
                      {ownerDetail.created_at ? new Date(ownerDetail.created_at).toLocaleDateString('en-IN') : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Linked Vehicles Section */}
                <div>
                  <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-[#174EA6] dark:text-[#3B82F6]" />
                    Linked Vehicles ({ownerDetail.vehicles?.length || 0})
                  </h4>
                  {ownerDetail.vehicles?.length === 0 ? (
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] bg-[#F7F9FC] dark:bg-[#162238]/60 p-3 rounded-xl text-center">
                      No vehicles linked to this account yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ownerDetail.vehicles.map((v: any) => (
                        <div
                          key={v.id}
                          className="p-3 bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-sm text-[#172033] dark:text-[#F1F5F9] block">
                              {v.plate_number}
                            </span>
                            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{v.model || v.vehicle_type}</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F7F9FC] dark:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] font-bold border border-[#E2E8F0] dark:border-[#1E293B]">
                            {v.rto_code || 'RTO'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Challans History */}
                <div>
                  <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#174EA6] dark:text-[#3B82F6]" />
                    Challan & Violation History ({ownerDetail.challans?.length || 0})
                  </h4>
                  {ownerDetail.challans?.length === 0 ? (
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] bg-[#F7F9FC] dark:bg-[#162238]/60 p-3 rounded-xl text-center">
                      No challans recorded for this owner.
                    </p>
                  ) : (
                    <div className="border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#F7F9FC] dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8] uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Vehicle</th>
                            <th className="py-2.5 px-3">Violation</th>
                            <th className="py-2.5 px-3">Fine</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] font-mono text-[11px] text-[#172033] dark:text-[#F1F5F9]">
                          {ownerDetail.challans.map((ch: any) => (
                            <tr key={ch.id} className="hover:bg-[#F7F9FC] dark:hover:bg-[#162238]/60">
                              <td className="py-2 px-3 font-bold">{ch.vehicle_plate}</td>
                              <td className="py-2 px-3 font-sans">{ch.violation}</td>
                              <td className="py-2 px-3 text-[#16856B] dark:text-[#34D399] font-bold">₹{ch.fine_amount}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    ch.status === 'paid'
                                      ? 'gov-badge-success'
                                      : 'gov-badge-warning'
                                  }`}
                                >
                                  {ch.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-[#64748B] dark:text-[#94A3B8]">
                                {ch.violation_datetime
                                  ? new Date(ch.violation_datetime).toLocaleDateString('en-IN')
                                  : 'N/A'}
                              </td>
                              <td className="py-2 px-3 text-[#64748B] dark:text-[#94A3B8]">
                                {ch.transaction_id || ch.payment_status}
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

            <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] flex justify-end">
              <button
                onClick={() => setSelectedOwnerId(null)}
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
