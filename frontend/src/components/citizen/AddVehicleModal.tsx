import React, { useState } from 'react';
import { PlusCircle, Car, ShieldCheck, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Vehicle } from '../../types';
import { getStoredVehicles, saveStoredVehicles } from '../../services/api';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVehicleAdded: (vehicle: Vehicle) => void;
  ownerName: string;
  ownerMobile: string;
}

export const AddVehicleModal: React.FC<AddVehicleModalProps> = ({
  isOpen,
  onClose,
  onVehicleAdded,
  ownerName,
  ownerMobile,
}) => {
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Two Wheeler (Motorcycle)');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim()) {
      setError('Please enter a valid registration plate number.');
      return;
    }
    setError(null);
    setLoading(true);

    const formattedPlate = plateNumber.trim().toUpperCase().replace(/\s+/g, '');
    const vehicles = getStoredVehicles();

    // Check if plate already registered
    const existing = vehicles.find((v) => v.plateNumber === formattedPlate);
    if (existing) {
      existing.ownerName = ownerName;
      existing.ownerMobile = ownerMobile;
      saveStoredVehicles(vehicles);
      onVehicleAdded(existing);
      setLoading(false);
      onClose();
      return;
    }

    const newVehicle: Vehicle = {
      id: Date.now(),
      plateNumber: formattedPlate,
      vehicleType,
      model: model.trim() || 'Motor Vehicle',
      rtoCode: formattedPlate.substring(0, 4),
      ownerName,
      ownerMobile,
    };

    vehicles.push(newVehicle);
    saveStoredVehicles(vehicles);
    onVehicleAdded(newVehicle);
    setLoading(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-[#174EA6] dark:text-[#3B82F6]" />
          <span className="font-bold text-[#172033] dark:text-[#F1F5F9]">Register Additional Vehicle (RTO RC)</span>
        </div>
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-[#172033] dark:text-[#F1F5F9]">
        <p className="text-[#64748B] dark:text-[#94A3B8]">
          Link your two-wheeler, four-wheeler, or commercial vehicle to receive automatic e-challan alerts.
        </p>

        {error && (
          <div className="p-3 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 rounded-xl text-[#DC2626] dark:text-[#F87171] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-[#172033] dark:text-[#F1F5F9] mb-1.5">
            Vehicle Registration Number <span className="text-[#DC2626]">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              placeholder="e.g. MH12AB1234"
              className="gov-input font-mono uppercase tracking-wider pr-12 text-sm"
            />
            <span className="absolute right-3.5 top-3 text-xs font-bold text-[#174EA6] dark:text-[#60A5FA] pointer-events-none">
              IND
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#172033] dark:text-[#F1F5F9] mb-1.5">
            Vehicle Classification <span className="text-[#DC2626]">*</span>
          </label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="gov-select text-xs"
          >
            <option value="Two Wheeler (Motorcycle / Scooter)">Two Wheeler (Motorcycle / Scooter)</option>
            <option value="Four Wheeler (Car / SUV)">Four Wheeler (Car / SUV)</option>
            <option value="Light Motor Vehicle (LMV)">Light Motor Vehicle (LMV)</option>
            <option value="Commercial Goods Vehicle">Commercial Goods Vehicle</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#172033] dark:text-[#F1F5F9] mb-1.5">
            Make & Model (as per RC)
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. Honda Activa 6G / Tata Nexon"
            className="gov-input text-xs"
          />
        </div>

        <div className="p-3 bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 border border-[#BFDBFE] dark:border-[#1E3A8A] rounded-xl text-[11px] text-[#174EA6] dark:text-[#60A5FA] flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 text-[#174EA6] dark:text-[#60A5FA] mt-0.5" />
          <span>
            Vehicle RC will be verified against Maharashtra RTO Vahan repository linked to +91 {ownerMobile}.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs py-2 px-4"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary text-xs py-2 px-4"
          >
            {loading ? 'Verifying with RTO...' : 'Add Vehicle to Profile'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
