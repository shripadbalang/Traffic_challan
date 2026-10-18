import React, { useState, useEffect } from 'react';
import {
  Car,
  Search,
  Users,
  FileText,
  AlertTriangle,
  Eye,
  X,
  Clock,
  ShieldCheck,
  MapPin,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  RefreshCw,
  Hash,
  ShieldAlert,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { api } from '../../services/api';
import { AdminVehicle } from '../../types';

const INDIAN_PLATE_REGEX = /^([A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/;

export const AdminVehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Vehicle Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    vehicle_number: '',
    owner_name: '',
    owner_mobile: '',
    owner_email: '',
    vehicle_model: '',
    vehicle_type: 'motorcycle',
  });
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});
  const [addLoading, setAddLoading] = useState(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);

  // Edit Vehicle Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<AdminVehicle | null>(null);
  const [editForm, setEditForm] = useState({
    vehicle_model: '',
    vehicle_type: 'motorcycle',
    owner_name: '',
    owner_mobile: '',
    owner_email: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [vehicleToDelete, setVehicleToDelete] = useState<AdminVehicle | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Inspect Detail Modal State
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [vehicleDetail, setVehicleDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchVehicles = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getAdminVehicles(search || undefined);
      setVehicles(res.items || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch vehicles list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [search]);

  // Clean plate number helper
  const cleanPlateNumber = (val: string) => {
    return val.toUpperCase().replace(/[\s-]/g, '');
  };

  // Clean mobile number helper
  const cleanMobileNumber = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    }
    return digits;
  };

  // Validate Add Vehicle Form
  const validateAddForm = () => {
    const errors: Record<string, string> = {};
    const plate = cleanPlateNumber(addForm.vehicle_number);

    if (!plate) {
      errors.vehicle_number = 'Vehicle number is required.';
    } else if (!INDIAN_PLATE_REGEX.test(plate)) {
      errors.vehicle_number = 'Invalid Indian vehicle number (e.g. MH34FG2334, DL01AB1234, 22BH1234AA).';
    }

    if (!addForm.owner_name.trim()) {
      errors.owner_name = 'Owner name is required.';
    }

    const mobile = cleanMobileNumber(addForm.owner_mobile);
    if (!mobile) {
      errors.owner_mobile = 'Owner mobile number is required.';
    } else if (mobile.length !== 10) {
      errors.owner_mobile = 'Mobile number must be a valid 10-digit number.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!addForm.owner_email.trim()) {
      errors.owner_email = 'Owner email is required.';
    } else if (!emailRegex.test(addForm.owner_email.trim())) {
      errors.owner_email = 'Please enter a valid email address.';
    }

    if (!addForm.vehicle_model.trim()) {
      errors.vehicle_model = 'Vehicle model is required (e.g. Honda Activa 6G, Bajaj Pulsar).';
    }

    setAddFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Add Vehicle Submission
  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddModalError(null);

    if (!validateAddForm()) {
      return;
    }

    setAddLoading(true);
    const cleanedPlate = cleanPlateNumber(addForm.vehicle_number);
    const cleanedMobile = cleanMobileNumber(addForm.owner_mobile);

    try {
      await api.createAdminVehicle({
        vehicle_number: cleanedPlate,
        owner_name: addForm.owner_name.trim(),
        owner_mobile: cleanedMobile,
        owner_email: addForm.owner_email.trim().toLowerCase(),
        vehicle_model: addForm.vehicle_model.trim(),
        vehicle_type: addForm.vehicle_type || undefined,
      });

      setIsAddModalOpen(false);
      setAddForm({
        vehicle_number: '',
        owner_name: '',
        owner_mobile: '',
        owner_email: '',
        vehicle_model: '',
        vehicle_type: 'motorcycle',
      });
      setAddFormErrors({});
      setSuccessMsg(`Vehicle ${cleanedPlate} registered successfully into the RTO database.`);
      setTimeout(() => setSuccessMsg(null), 6000);
      fetchVehicles();
    } catch (err: any) {
      setAddModalError(err.message || 'Failed to add vehicle. Please check your inputs.');
    } finally {
      setAddLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (v: AdminVehicle) => {
    setEditingVehicle(v);
    setEditForm({
      vehicle_model: v.model || '',
      vehicle_type: v.vehicle_type || 'motorcycle',
      owner_name: v.owner_name || '',
      owner_mobile: v.owner_mobile || v.registered_mobile || '',
      owner_email: v.owner_email || '',
    });
    setEditModalError(null);
    setIsEditModalOpen(true);
  };

  // Handle Edit Vehicle Submission
  const handleEditVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    setEditModalError(null);
    setEditLoading(true);

    try {
      await api.updateAdminVehicle(editingVehicle.plate_number, {
        vehicle_model: editForm.vehicle_model.trim() || undefined,
        vehicle_type: editForm.vehicle_type || undefined,
        owner_name: editForm.owner_name.trim() || undefined,
        owner_mobile: editForm.owner_mobile.trim() ? cleanMobileNumber(editForm.owner_mobile) : undefined,
        owner_email: editForm.owner_email.trim() ? editForm.owner_email.trim().toLowerCase() : undefined,
      });

      setIsEditModalOpen(false);
      setEditingVehicle(null);
      setSuccessMsg(`Vehicle ${editingVehicle.plate_number} details updated successfully.`);
      setTimeout(() => setSuccessMsg(null), 6000);
      fetchVehicles();
    } catch (err: any) {
      setEditModalError(err.message || 'Failed to update vehicle.');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!vehicleToDelete) return;

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await api.deleteAdminVehicle(vehicleToDelete.plate_number);
      setSuccessMsg(`Vehicle ${vehicleToDelete.plate_number} deleted from registry.`);
      setTimeout(() => setSuccessMsg(null), 6000);
      setVehicleToDelete(null);
      fetchVehicles();
    } catch (err: any) {
      setDeleteError(err.message || 'Cannot delete vehicle.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Inspect Vehicle History
  const handleInspectVehicle = async (plate: string) => {
    setSelectedPlate(plate);
    setDetailLoading(true);
    try {
      const detail = await api.getAdminVehicleDetail(plate);
      setVehicleDetail(detail);
    } catch {
      setVehicleDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Vehicle Registry & Management"
      subtitle="Central RTO Vehicle Registry, Ownership Database & Challan Records"
    >
      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 dark:text-emerald-400 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 dark:text-rose-400 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by plate (e.g. MH34FG2334), model, owner, mobile..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800"
          />
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchVehicles()}
            title="Refresh Registry"
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setAddModalError(null);
              setAddFormErrors({});
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vehicle</span>
          </button>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium pl-2 hidden md:block border-l border-slate-200 dark:border-slate-800">
            Total Vehicles: <strong className="text-slate-900 dark:text-slate-100">{vehicles.length}</strong>
          </div>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-amber-500 rounded-full animate-spin" />
            <span>Loading registered vehicles...</span>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
            <Car className="w-10 h-10 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">No vehicles found in registry.</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Click &ldquo;Add Vehicle&rdquo; to register the first vehicle record.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Registration Plate</th>
                  <th className="py-3.5 px-4">Vehicle Details</th>
                  <th className="py-3.5 px-4">Registered Owner</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Violations</th>
                  <th className="py-3.5 px-4">Pending Fine</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-300/80 dark:border-amber-700/60 inline-block shadow-xs">
                          {v.plate_number}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {v.rto_code || v.plate_number.slice(0, 4)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">{v.model}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wide text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        {v.vehicle_type || 'Motorcycle'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">{v.owner_name}</span>
                      {v.owner_email && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          {v.owner_email}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-700 dark:text-slate-300 font-mono font-semibold flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          {v.registered_mobile || v.owner_mobile ? `+91 ${v.registered_mobile || v.owner_mobile}` : 'N/A'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                          RTO Code: {v.rto_code || v.plate_number.slice(0, 4)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{v.total_challans} issued</span>
                      {v.pending_challans > 0 ? (
                        <span className="text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded font-bold inline-block mt-0.5">
                          {v.pending_challans} unpaid
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded font-bold inline-block mt-0.5">
                          All clear
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-black text-xs ${
                          v.pending_fine_amount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        ₹{v.pending_fine_amount.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleInspectVehicle(v.plate_number)}
                          title="View Violation History"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(v)}
                          title="Edit Vehicle & Owner"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setVehicleToDelete(v);
                          }}
                          title="Delete Vehicle Registration"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* 1. ADD VEHICLE MODAL */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Add Vehicle to Registry</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Register new vehicle and associate registered owner details</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addModalError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span>{addModalError}</span>
              </div>
            )}

            <form onSubmit={handleAddVehicleSubmit} className="space-y-4">
              {/* Vehicle Number Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Vehicle Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. MH34FG2334"
                    value={addForm.vehicle_number}
                    onChange={(e) => {
                      const cleaned = cleanPlateNumber(e.target.value);
                      setAddForm({ ...addForm, vehicle_number: cleaned });
                      if (addFormErrors.vehicle_number) {
                        setAddFormErrors({ ...addFormErrors, vehicle_number: '' });
                      }
                    }}
                    className={`w-full font-mono uppercase px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border ${
                      addFormErrors.vehicle_number ? 'border-rose-300 ring-2 ring-rose-100 dark:ring-rose-900/40' : 'border-slate-300 dark:border-slate-700'
                    } rounded-xl text-xs font-bold tracking-wider text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800`}
                  />
                  <Hash className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-3 pointer-events-none" />
                </div>
                {addFormErrors.vehicle_number ? (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{addFormErrors.vehicle_number}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Auto-uppercased. Standard format (MH34FG2334) or Bharat series (22BH1234AA).
                  </p>
                )}
              </div>

              {/* Owner Name Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Owner Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shri"
                  value={addForm.owner_name}
                  onChange={(e) => {
                    setAddForm({ ...addForm, owner_name: e.target.value });
                    if (addFormErrors.owner_name) {
                      setAddFormErrors({ ...addFormErrors, owner_name: '' });
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border ${
                    addFormErrors.owner_name ? 'border-rose-300 ring-2 ring-rose-100 dark:ring-rose-900/40' : 'border-slate-300 dark:border-slate-700'
                  } rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800`}
                />
                {addFormErrors.owner_name && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{addFormErrors.owner_name}</p>
                )}
              </div>

              {/* Owner Mobile & Email Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Owner Mobile <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2233433335"
                      maxLength={15}
                      value={addForm.owner_mobile}
                      onChange={(e) => {
                        setAddForm({ ...addForm, owner_mobile: e.target.value });
                        if (addFormErrors.owner_mobile) {
                          setAddFormErrors({ ...addFormErrors, owner_mobile: '' });
                        }
                      }}
                      className={`w-full px-3.5 py-2.5 font-mono bg-slate-50 dark:bg-slate-800/80 border ${
                        addFormErrors.owner_mobile ? 'border-rose-300 ring-2 ring-rose-100 dark:ring-rose-900/40' : 'border-slate-300 dark:border-slate-700'
                      } rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800`}
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                  {addFormErrors.owner_mobile && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{addFormErrors.owner_mobile}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Owner Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="e.g. xyz@gmail.com"
                      value={addForm.owner_email}
                      onChange={(e) => {
                        setAddForm({ ...addForm, owner_email: e.target.value });
                        if (addFormErrors.owner_email) {
                          setAddFormErrors({ ...addFormErrors, owner_email: '' });
                        }
                      }}
                      className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border ${
                        addFormErrors.owner_email ? 'border-rose-300 ring-2 ring-rose-100 dark:ring-rose-900/40' : 'border-slate-300 dark:border-slate-700'
                      } rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800`}
                    />
                    <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                  {addFormErrors.owner_email && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{addFormErrors.owner_email}</p>
                  )}
                </div>
              </div>

              {/* Vehicle Model & Type Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Vehicle Model <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. XYZ, Honda Activa 6G"
                    value={addForm.vehicle_model}
                    onChange={(e) => {
                      setAddForm({ ...addForm, vehicle_model: e.target.value });
                      if (addFormErrors.vehicle_model) {
                        setAddFormErrors({ ...addFormErrors, vehicle_model: '' });
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border ${
                      addFormErrors.vehicle_model ? 'border-rose-300 ring-2 ring-rose-100 dark:ring-rose-900/40' : 'border-slate-300 dark:border-slate-700'
                    } rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800`}
                  />
                  {addFormErrors.vehicle_model && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{addFormErrors.vehicle_model}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Vehicle Class
                  </label>
                  <select
                    value={addForm.vehicle_type}
                    onChange={(e) => setAddForm({ ...addForm, vehicle_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="motorcycle">Two Wheeler (Motorcycle / Scooter)</option>
                    <option value="car">Four Wheeler (Car / SUV / Sedan)</option>
                    <option value="heavy">Commercial / Heavy Vehicle (Bus / Truck)</option>
                    <option value="auto">Three Wheeler (Auto-Rickshaw)</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {addLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add Vehicle</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT VEHICLE MODAL */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Edit Vehicle Information</h3>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{editingVehicle.plate_number}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editModalError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span>{editModalError}</span>
              </div>
            )}

            <form onSubmit={handleEditVehicleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Registration Plate Number (Fixed)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingVehicle.plate_number}
                  className="w-full px-3.5 py-2.5 font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Vehicle Model
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.vehicle_model}
                    onChange={(e) => setEditForm({ ...editForm, vehicle_model: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Vehicle Class
                  </label>
                  <select
                    value={editForm.vehicle_type}
                    onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="motorcycle">Two Wheeler (Motorcycle)</option>
                    <option value="car">Four Wheeler (Car)</option>
                    <option value="heavy">Heavy Vehicle</option>
                    <option value="auto">Three Wheeler</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Registered Owner Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.owner_name}
                  onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Registered Mobile
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={editForm.owner_mobile}
                    onChange={(e) => setEditForm({ ...editForm, owner_mobile: e.target.value })}
                    className="w-full px-3.5 py-2.5 font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    value={editForm.owner_email}
                    onChange={(e) => setEditForm({ ...editForm, owner_email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Delete Vehicle Registration</h3>
                <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">{vehicleToDelete.plate_number}</p>
              </div>
            </div>

            {vehicleToDelete.total_challans > 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>Cannot Delete Encumbered Vehicle</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  This vehicle has <strong>{vehicleToDelete.total_challans} recorded challan(s)</strong> (₹{vehicleToDelete.pending_fine_amount} pending). For legal audit trail integrity, vehicles with active or past violations cannot be deleted.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete registration for vehicle{' '}
                <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold">{vehicleToDelete.plate_number}</strong> ({vehicleToDelete.model})?
                This action is irreversible.
              </p>
            )}

            {deleteError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setVehicleToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
              {vehicleToDelete.total_challans === 0 && (
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={handleDeleteConfirm}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Registration'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. INSPECT VEHICLE DETAIL & CHALLANS MODAL */}
      {/* ========================================================================= */}
      {selectedPlate && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{selectedPlate}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {vehicleDetail?.model || 'Motor Vehicle'} • RTO: {vehicleDetail?.rto_code || 'MH'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlate(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading || !vehicleDetail ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-700 border-t-amber-500 rounded-full animate-spin" />
                <span>Loading vehicle violation records...</span>
              </div>
            ) : (
              <>
                {/* Vehicle & Owner Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Vehicle Model</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">{vehicleDetail.model || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Vehicle Class</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5 capitalize">
                      {vehicleDetail.vehicle_type || 'Motorcycle'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Registered Owner</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                      {vehicleDetail.owner?.full_name || 'Unregistered'}
                    </span>
                    {vehicleDetail.owner?.email && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">{vehicleDetail.owner.email}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Contact Number</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono block mt-0.5">
                      {vehicleDetail.registered_mobile || vehicleDetail.owner?.mobile_number
                        ? `+91 ${vehicleDetail.registered_mobile || vehicleDetail.owner?.mobile_number}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Challans Table for this Vehicle */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    Challans Issued to this Vehicle ({vehicleDetail.challans?.length || 0})
                  </h4>

                  {vehicleDetail.challans?.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-center">
                      No violations recorded for this vehicle. Clean driving history.
                    </p>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Violation</th>
                            <th className="py-2.5 px-3">Fine Amount</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Detection Source</th>
                            <th className="py-2.5 px-3">Datetime</th>
                            <th className="py-2.5 px-3">Location</th>
                            <th className="py-2.5 px-3">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                          {vehicleDetail.challans.map((ch: any) => (
                            <tr key={ch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-sans font-bold text-slate-800 dark:text-slate-200">
                                {ch.violation}
                              </td>
                              <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">
                                ₹{ch.fine_amount}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    ch.status === 'paid'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  }`}
                                >
                                  {ch.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-sans uppercase text-[10px]">
                                {ch.detection_source}
                                {ch.ai_confidence ? ` (${Math.round(ch.ai_confidence * 100)}%)` : ''}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                {ch.datetime ? new Date(ch.datetime).toLocaleDateString('en-IN') : 'N/A'}
                              </td>
                              <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400 max-w-xs truncate">
                                {ch.location || 'N/A'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
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

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPlate(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
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
