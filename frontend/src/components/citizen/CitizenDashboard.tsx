import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car,
  AlertTriangle,
  CheckCircle2,
  FileText,
  CreditCard,
  QrCode,
  Eye,
  Filter,
  Shield,
  Phone,
  Mail,
  User as UserIcon,
  RefreshCw,
  Building2,
  Calendar,
  MapPin,
  Lock,
  Printer,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Challan, Vehicle } from '../../types';
import { api } from '../../services/api';
import { EvidenceViewer } from './EvidenceViewer';
import { PaymentModal } from './PaymentModal';
import { QRReceiptModal } from '../common/QRReceiptModal';

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [selectedPlate, setSelectedPlate] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'paid'>('ALL');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedChallanForEvidence, setSelectedChallanForEvidence] = useState<Challan | null>(null);
  const [selectedChallanForPayment, setSelectedChallanForPayment] = useState<Challan | null>(null);
  const [selectedChallanForReceipt, setSelectedChallanForReceipt] = useState<Challan | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/citizen/login');
      return;
    }
    fetchOwnerData();
  }, [user, navigate]);

  const fetchOwnerData = async () => {
    setLoading(true);
    try {
      // 1. Fetch strictly authenticated owner's vehicles from backend
      const ownerVehicles = await api.getMyVehicles();
      setVehicles(ownerVehicles);

      // 2. Fetch strictly authenticated owner's challans from backend
      const ownerChallans = await api.getMyChallans();
      setChallans(ownerChallans);

      // Default select the first vehicle if available
      if (ownerVehicles.length > 0 && selectedPlate === 'ALL') {
        // keep 'ALL' as default or select first plate
      }
    } catch (err) {
      console.error('Error fetching owner data:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeVehicle =
    selectedPlate === 'ALL'
      ? vehicles[0]
      : vehicles.find((v) => v.plateNumber === selectedPlate) || vehicles[0];

  const filteredChallans = challans.filter((c) => {
    const matchesPlate = selectedPlate === 'ALL' || c.vehiclePlate === selectedPlate;
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesPlate && matchesStatus;
  });

  const pendingChallans = challans.filter((c) => c.status === 'pending');
  const paidChallans = challans.filter((c) => c.status === 'paid');

  const pendingDues = pendingChallans.reduce((sum, c) => sum + c.fineAmount, 0);
  const totalPaid = paidChallans.reduce((sum, c) => sum + c.fineAmount, 0);

  const handlePaymentSuccess = (updatedChallan: Challan) => {
    setChallans((prev) => prev.map((c) => (c.id === updatedChallan.id ? updatedChallan : c)));
    setSelectedChallanForPayment(null);
    setSelectedChallanForReceipt(updatedChallan);
    // Refresh data from backend to ensure DB parity
    fetchOwnerData();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16 font-sans">
      {/* Official Government Transport Portal Header */}
      <div className="bg-[#0f2942] text-white border-b-4 border-amber-500 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-amber-400">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                  Government of Maharashtra • Transport Department
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Welcome, {user?.fullName || 'Enter Name'}
                </h1>
                <p className="text-xs text-slate-300">
                  Registered Vehicle Owner Service Portal • Parivahan E-Challan Clearance Desk
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={fetchOwnerData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Records
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Vehicle Details Card (Vahan Database Verified Information) */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-800" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Registered Vehicle Details (Vahan RTO Record)
              </h2>
            </div>
            {vehicles.length > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Switch Vehicle:</span>
                <select
                  value={selectedPlate}
                  onChange={(e) => setSelectedPlate(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ALL">All Registered Vehicles ({vehicles.length})</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.plateNumber}>
                      {v.plateNumber} ({v.model})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
            {/* Owner Name */}
            <div className="space-y-1">
              <span className="text-slate-500 font-medium block">Owner Full Name</span>
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-900">
                  {activeVehicle?.ownerName || user?.fullName || 'Payal Sune'}
                </span>
              </div>
            </div>

            {/* Vehicle Plate Number */}
            <div className="space-y-1">
              <span className="text-slate-500 font-medium block">Vehicle Registration Number</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-extrabold text-slate-900 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300 tracking-wider">
                  {activeVehicle?.plateNumber || 'MH 37 AB 0949'}
                </span>
              </div>
            </div>

            {/* Vehicle Type */}
            <div className="space-y-1">
              <span className="text-slate-500 font-medium block">Vehicle Type / Category</span>
              <span className="text-sm font-semibold text-slate-800 capitalize block">
                {activeVehicle?.vehicleType === 'motorcycle' ? 'Two Wheeler (Motorcycle / Scooter)' : activeVehicle?.vehicleType || 'Two Wheeler'}
              </span>
            </div>

            {/* Vehicle Model */}
            <div className="space-y-1">
              <span className="text-slate-500 font-medium block">Vehicle Make & Model</span>
              <span className="text-sm font-semibold text-slate-800 block">
                {activeVehicle?.model || 'Honda Activa 6G'}
              </span>
            </div>

            {/* Masked Mobile */}
            <div className="space-y-1">
              <span className="text-slate-500 font-medium block">Registered Mobile Number</span>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-mono font-semibold text-slate-900">
                  +91 {activeVehicle?.maskedMobile || (user?.mobileNumber ? `******${user.mobileNumber.slice(-4)}` : '******6011')}
                </span>
              </div>
            </div>

            {/* Masked Email */}
            <div className="space-y-1">
              <span className="text-slate-500 font-medium block">Registered Email Address</span>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-mono font-semibold text-slate-900">
                  {activeVehicle?.maskedEmail || 'p****@example.com'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status KPI Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Unpaid Citations
              </span>
              <span className="text-2xl font-black text-rose-700 mt-1 block">
                {pendingChallans.length}
              </span>
              <span className="text-[11px] text-slate-500">Requires immediate settlement</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Unpaid Dues
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                ₹{pendingDues.toLocaleString('en-IN')}.00
              </span>
              <span className="text-[11px] text-slate-500">Outstanding fine amount</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Settled Challans
              </span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {paidChallans.length}
              </span>
              <span className="text-[11px] text-slate-500">Cleared & verified in database</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Amount Settled
              </span>
              <span className="text-2xl font-black text-emerald-800 mt-1 block">
                ₹{totalPaid.toLocaleString('en-IN')}.00
              </span>
              <span className="text-[11px] text-slate-500">Official receipt available</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Challans List Table */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-800" />
                Traffic Violation Citations (E-Challans)
              </h3>
              <p className="text-xs text-slate-500">
                Showing citation history recorded by Maharashtra Traffic Police
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-200/80 p-1 rounded-lg text-xs font-semibold">
              {(['ALL', 'pending', 'paid'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 rounded-md transition ${
                    statusFilter === filter
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {filter === 'ALL' ? 'All Challans' : filter === 'pending' ? 'Unpaid Only' : 'Paid Only'}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Challan ID</th>
                  <th className="py-3 px-4">Violation Date & Time</th>
                  <th className="py-3 px-4">Vehicle Number</th>
                  <th className="py-3 px-4">Violation Type</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Fine Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Payment Date</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredChallans.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                      No challan records found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredChallans.map((c) => {
                    const isPaid = c.status === 'paid';
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition">
                        {/* Challan ID */}
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          {c.id.slice(0, 8).toUpperCase()}
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {new Date(c.violationDatetime).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        {/* Vehicle Number */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {c.vehiclePlate}
                          </span>
                        </td>

                        {/* Violation Type */}
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {c.violation}
                        </td>

                        {/* Location */}
                        <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate" title={c.location}>
                          {c.location}
                        </td>

                        {/* Fine Amount */}
                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                          ₹{c.fineAmount.toLocaleString('en-IN')}.00
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {isPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>

                        {/* Payment Date */}
                        <td className="py-3 px-4 text-center text-slate-600 whitespace-nowrap">
                          {c.paymentDate ? (
                            new Date(c.paymentDate).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedChallanForEvidence(c)}
                              title="View official violation photo evidence"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] border border-slate-300 transition"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-700" /> Evidence
                            </button>

                            {!isPaid ? (
                              <button
                                type="button"
                                onClick={() => setSelectedChallanForPayment(c)}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] shadow-sm transition"
                              >
                                <CreditCard className="w-3.5 h-3.5" /> Pay Now
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedChallanForReceipt(c)}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold text-[11px] shadow-sm transition"
                              >
                                <Printer className="w-3.5 h-3.5" /> Receipt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EvidenceViewer
        isOpen={!!selectedChallanForEvidence}
        onClose={() => setSelectedChallanForEvidence(null)}
        challan={selectedChallanForEvidence}
      />

      <PaymentModal
        isOpen={!!selectedChallanForPayment}
        onClose={() => setSelectedChallanForPayment(null)}
        challan={selectedChallanForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <QRReceiptModal
        isOpen={!!selectedChallanForReceipt}
        onClose={() => setSelectedChallanForReceipt(null)}
        challan={selectedChallanForReceipt}
      />
    </div>
  );
};
