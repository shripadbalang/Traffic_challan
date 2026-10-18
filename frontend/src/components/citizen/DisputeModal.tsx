import React, { useState } from 'react';
import { AlertCircle, FileText, Send, CheckCircle2 } from 'lucide-react';
import { Challan } from '../../types';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: Challan | null;
  onDisputed: (updatedChallan: Challan) => void;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({
  isOpen,
  onClose,
  challan,
  onDisputed,
}) => {
  const [reason, setReason] = useState('Number plate incorrectly recognized by AI camera');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!challan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fullReason = `${reason}: ${explanation}`;
      const updated = await api.disputeChallan(challan.id, fullReason);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSubmitting(false);
        onDisputed(updated);
        onClose();
      }, 1000);
    } catch {
      alert('Failed to submit dispute grievance.');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-[#D97706] dark:text-[#FBBF24]" />
          <span className="font-bold text-[#172033] dark:text-[#F1F5F9]">Contest / Dispute E-Challan</span>
        </div>
      }
      maxWidth="md"
    >
      {submitted ? (
        <div className="py-8 text-center space-y-2">
          <CheckCircle2 className="w-12 h-12 text-[#16856B] dark:text-[#34D399] mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-[#172033] dark:text-[#F1F5F9]">Grievance Submitted Successfully</h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Case Ref: DISP-{challan.id.replace('CH-', '')}. An adjudication officer will review your evidence.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-[#172033] dark:text-[#F1F5F9]">
          <div className="p-3 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B]">
            <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Challan Reference: #{challan.id}</span>
            <span className="text-[#172033] dark:text-[#F1F5F9] font-bold block mt-0.5">
              {challan.violation} (₹{Number(challan.fineAmount).toLocaleString('en-IN')})
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#172033] dark:text-[#F1F5F9] mb-1.5">
              Select Dispute Category <span className="text-[#DC2626]">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="gov-select text-xs"
            >
              <option value="Number plate incorrectly recognized by AI camera">
                Number plate incorrectly recognized by AI camera
              </option>
              <option value="Vehicle was sold / transferred before this date">
                Vehicle was sold / transferred before this date
              </option>
              <option value="Driver was wearing ISI helmet (false positive)">
                Driver was wearing ISI helmet (false positive)
              </option>
              <option value="Emergency medical situation or ambulance escort">
                Emergency medical situation or ambulance escort
              </option>
              <option value="Vehicle stolen / misused by third party">
                Vehicle stolen / misused by third party
              </option>
              <option value="Other grievance">Other grievance</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#172033] dark:text-[#F1F5F9] mb-1.5">
              Detailed Explanation & Justification <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Describe why this challan was issued in error. Include registration certificate or proof details..."
              className="gov-input text-xs resize-none"
            />
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
              disabled={submitting || !explanation.trim()}
              className="btn-primary text-xs py-2 px-4"
            >
              {submitting ? 'Registering Dispute...' : 'Submit Grievance'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
