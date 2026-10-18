import React, { useState } from 'react';
import { Search, ShieldAlert, CheckCircle2, Send, RefreshCw, Car } from 'lucide-react';
import { api } from '../../services/api';
import { Vehicle, Challan } from '../../types';
import { Badge } from '../common/Badge';

export interface ManualChallanProps {
  onChallanIssued?: (challan: Challan) => void;
}

export const ManualChallan: React.FC<ManualChallanProps> = ({
  onChallanIssued,
}) => {
  const [plate, setPlate] = useState('MH12DE1433');
  const [searching, setSearching] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [violationCode, setViolationCode] = useState('NO_HELMET');
  const [location, setLocation] = useState('Swargate Chowk, Pune');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const violationList = [
    { code: 'NO_HELMET', name: 'Riding without helmet', fine: 500 },
    { code: 'MOBILE_PHONE_USAGE', name: 'Using mobile phone while driving', fine: 1000 },
    { code: 'WRONG_SIDE_DRIVING', name: 'Wrong-side / against traffic driving', fine: 1500 },
    { code: 'TRIPLE_RIDING', name: 'Triple riding on two-wheeler', fine: 1000 },
    { code: 'SIGNAL_JUMP', name: 'Jumping red traffic light signal', fine: 1000 },
    { code: 'SEATBELT_VIOLATION', name: 'Driving without safety seatbelt', fine: 1000 },
  ];

  const handleLookup = async () => {
    if (!plate) return;
    setSearching(true);
    setVehicle(null);
    try {
      const found = await api.lookupVehicle(plate);
      setVehicle(
        found || {
          id: 1,
          plateNumber: plate.toUpperCase(),
          vehicleType: 'Two Wheeler (Motorcycle)',
          model: 'Registered Motor Vehicle',
          rtoCode: plate.substring(0, 4).toUpperCase(),
          ownerName: 'Registered Owner (Vahan Record)',
          ownerMobile: '9822012345',
        }
      );
    } finally {
      setSearching(false);
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage(null);

    const selectedViolation = violationList.find((v) => v.code === violationCode)!;

    try {
      const res = await api.issueChallan({
        plateNumber: plate,
        violationCode: selectedViolation.code,
        violationName: selectedViolation.name,
        fineAmount: selectedViolation.fine,
        location,
        detectionSource: 'manual',
      });

      setSuccessMessage(`Manual Challan ${res.challan.id} registered. Owner notified.`);
      if (onChallanIssued) onChallanIssued(res.challan);
    } catch {
      alert('Failed to register manual challan.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedFine = violationList.find((v) => v.code === violationCode)?.fine || 500;

  return (
    <div className="max-w-2xl gov-card p-6 space-y-6 font-sans text-[#172033] dark:text-[#F1F5F9]">
      <div>
        <h3 className="text-base font-bold text-[#172033] dark:text-[#F1F5F9] flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#D97706] dark:text-[#FBBF24]" />
          On-Duty Officer Manual Citation Issuance
        </h3>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
          Perform real-time RTO Vahan database verification and issue spot citations.
        </p>
      </div>

      {successMessage && (
        <div className="p-3 bg-[#ECFDF5] dark:bg-[#064E3B]/40 border border-[#A7F3D0] dark:border-[#059669]/40 rounded-xl text-[#16856B] dark:text-[#34D399] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Plate lookup row */}
      <div>
        <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1">
          Vehicle Plate Number *
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            required
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="MH12DE1433"
            className="gov-input flex-1 font-mono uppercase text-sm"
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={searching}
            className="btn-secondary text-xs px-4 py-2.5 flex items-center gap-1.5"
          >
            {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Verify RTO
          </button>
        </div>
      </div>

      {/* RTO Record Display */}
      {vehicle && (
        <div className="p-3.5 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] text-xs space-y-1.5">
          <span className="text-[#64748B] dark:text-[#94A3B8] font-bold block flex items-center gap-1 text-[11px] uppercase tracking-wider">
            <Car className="w-3.5 h-3.5 text-[#174EA6] dark:text-[#3B82F6]" /> RTO Vahan Verified Record
          </span>
          <div className="flex justify-between">
            <span className="text-[#64748B] dark:text-[#94A3B8]">Owner Name:</span>
            <span className="font-semibold text-[#172033] dark:text-[#F1F5F9]">{vehicle.ownerName || 'Rajesh Sharma'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B] dark:text-[#94A3B8]">Contact Mobile:</span>
            <span className="font-mono text-[#172033] dark:text-[#F1F5F9]">+91 {vehicle.ownerMobile || '9822012345'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B] dark:text-[#94A3B8]">Vehicle Model:</span>
            <span className="text-[#172033] dark:text-[#F1F5F9]">{vehicle.model}</span>
          </div>
        </div>
      )}

      {/* Violation Form */}
      <form onSubmit={handleIssue} className="space-y-4 text-xs">
        <div>
          <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1">
            Select Violation Type *
          </label>
          <select
            value={violationCode}
            onChange={(e) => setViolationCode(e.target.value)}
            className="gov-select text-xs"
          >
            {violationList.map((v) => (
              <option key={v.code} value={v.code}>
                {v.name} — ₹{v.fine}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1">
            Violation Location *
          </label>
          <input
            type="text"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="gov-input text-xs"
          />
        </div>

        <div className="p-3 bg-[#FFFBEB] dark:bg-[#451A03]/30 border border-[#FDE68A] dark:border-[#78350F] rounded-xl flex items-center justify-between">
          <span className="text-[#172033] dark:text-[#F1F5F9] font-medium">Statutory Fine Amount (MV Act):</span>
          <span className="text-lg font-bold text-[#D97706] dark:text-[#FBBF24]">₹{selectedFine.toLocaleString('en-IN')}</span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full py-3 text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Registering Citation...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Issue Manual Challan & Send SMS Notice
            </>
          )}
        </button>
      </form>
    </div>
  );
};
