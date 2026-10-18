import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Car,
  CreditCard,
  QrCode,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Challan } from '../../types';
import { getStoredChallans } from '../../services/api';
import { Badge } from '../common/Badge';
import { EvidenceViewer } from '../citizen/EvidenceViewer';
import { PaymentModal } from '../citizen/PaymentModal';
import { QRReceiptModal } from '../common/QRReceiptModal';

export const LandingPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('MH12DE1433');
  const [searchResults, setSearchResults] = useState<Challan[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Modals for quick pay from landing page
  const [selectedForEvidence, setSelectedForEvidence] = useState<Challan | null>(null);
  const [selectedForPayment, setSelectedForPayment] = useState<Challan | null>(null);
  const [selectedForReceipt, setSelectedForReceipt] = useState<Challan | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const all = getStoredChallans();
    const cleanQuery = searchQuery.trim().replace(/\s+/g, '').toUpperCase();
    const matches = all.filter(
      (c) =>
        (c.vehiclePlate || '').replace(/\s+/g, '').toUpperCase() ===
          cleanQuery || String(c.id).replace(/\s+/g, '').toUpperCase() === cleanQuery
    );
    setSearchResults(matches);
    setHasSearched(true);
  };

  const handlePaymentSuccess = (updatedChallan: Challan) => {
    setSearchResults((prev) =>
      prev ? prev.map((c) => (c.id === updatedChallan.id ? updatedChallan : c)) : null
    );
    setSelectedForPayment(null);
    setSelectedForReceipt(updatedChallan);
  };

  return (
    <div className="w-full bg-smart-traffic-hero min-h-[calc(100vh-140px)]">
      <div className="space-y-14 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-sans">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 border border-[#BFDBFE] dark:border-[#1E3A8A] text-[#174EA6] dark:text-[#60A5FA] text-xs font-bold">
          <Cpu className="w-3.5 h-3.5" /> Next-Gen AI Traffic Enforcement & E-Challan
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight leading-tight">
          Automated Traffic Violation Detection & Digital E-Challan Portal
        </h1>
        <p className="text-sm sm:text-base text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
          State of Maharashtra unified platform for video-based violation detection (Helmet, Phone
          Usage, Wrong Side, Triple Riding), automatic number plate recognition (ANPR), and seamless
          citizen clearance with QR-authenticated digital receipts.
        </p>
      </div>

      {/* Quick Search & Pay Bar */}
      <div className="max-w-2xl mx-auto gov-card p-6 sm:p-8">
        <div className="mb-4">
          <h2 className="text-base font-bold text-[#172033] dark:text-[#F1F5F9] flex items-center gap-2">
            <Search className="w-4 h-4 text-[#174EA6] dark:text-[#3B82F6]" />
            Quick Challan Search & Instant Settlement
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Check and clear outstanding citations instantly without login.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              required
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              placeholder="Enter Vehicle Plate (e.g. MH12DE1433) or Challan ID"
              className="gov-input font-mono uppercase pr-12 py-3"
            />
            <span className="absolute right-3.5 top-3.5 text-xs font-bold text-[#174EA6] dark:text-[#60A5FA] pointer-events-none">
              IND
            </span>
          </div>

          <button type="submit" className="btn-primary px-6 py-3 text-xs uppercase tracking-wider">
            <Search className="w-4 h-4" /> Check Dues
          </button>
        </form>

        {/* Search Results Preview */}
        {hasSearched && (
          <div className="mt-6 pt-5 border-t border-[#E2E8F0] dark:border-[#1E293B] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B] dark:text-[#94A3B8]">
                Found <strong className="text-[#172033] dark:text-[#F1F5F9]">{searchResults?.length || 0}</strong>{' '}
                record(s) for <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">{searchQuery}</span>
              </span>
            </div>

            {searchResults && searchResults.length > 0 ? (
              <div className="space-y-2.5">
                {searchResults.map((c) => {
                  const isPending = c.status !== 'paid';
                  return (
                    <div
                      key={c.id}
                      className="p-3.5 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">#{c.id}</span>
                          <Badge status={c.status} />
                        </div>
                        <span className="text-[#172033] dark:text-[#F1F5F9] font-semibold block mt-1">
                          {c.violation}
                        </span>
                        <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{c.location}</span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="font-bold font-mono text-[#172033] dark:text-[#F1F5F9] text-sm mr-2">
                          ₹{Number(c.fineAmount).toLocaleString('en-IN')}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedForEvidence(c)}
                          className="p-2 rounded-lg bg-white dark:bg-[#111C2E] hover:bg-[#F1F5F9] dark:hover:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] border border-[#E2E8F0] dark:border-[#1E293B] transition"
                          title="View photo proof"
                        >
                          <Eye className="w-4 h-4 text-[#174EA6] dark:text-[#3B82F6]" />
                        </button>

                        {isPending && (
                          <button
                            type="button"
                            onClick={() => setSelectedForPayment(c)}
                            className="btn-primary py-1.5 px-3 text-xs"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Pay Now
                          </button>
                        )}

                        {c.status === 'paid' && (
                          <button
                            type="button"
                            onClick={() => setSelectedForReceipt(c)}
                            className="btn-success py-1.5 px-3 text-xs"
                          >
                            <QrCode className="w-3.5 h-3.5" /> QR Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-[#ECFDF5] dark:bg-[#064E3B]/30 border border-[#A7F3D0] dark:border-[#059669]/40 rounded-xl text-center text-xs text-[#16856B] dark:text-[#34D399] font-medium">
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-[#16856B] dark:text-[#34D399]" />
                No pending violations recorded for this vehicle. Record is 100% clean!
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3 Vehicle Owner Feature Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {/* Card 1: OTP Access */}
        <div className="gov-card-interactive p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-[#172554] text-[#174EA6] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E3A8A] flex items-center justify-center">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#172033] dark:text-[#F1F5F9]">Vehicle Owner Access</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
                Link all your two-wheelers and four-wheelers with your registered contact details.
              </p>
            </div>
            <ul className="text-xs text-[#172033] dark:text-[#F1F5F9] space-y-2.5">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
                <span>Passwordless OTP login every time</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
                <span>Automatic RTO Vahan RC verification</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
                <span>Available in English, मराठी (Marathi), and हिन्दी (Hindi)</span>
              </li>
            </ul>
          </div>
          <div className="pt-6">
            <Link to="/citizen/dashboard" className="w-full btn-primary text-xs">
              Open Owner Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 2: AI Evidence & Bounding Boxes */}
        <div className="gov-card-interactive p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-[#172554] text-[#174EA6] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E3A8A] flex items-center justify-center">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#172033] dark:text-[#F1F5F9]">Visual Proof & Evidence</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
                Transparent violation evidence captured by city surveillance cameras.
              </p>
            </div>
            <ul className="text-xs text-[#172033] dark:text-[#F1F5F9] space-y-2.5">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
                <span>High-resolution photo & video violation proof</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
                <span>AI bounding boxes on rider & number plate</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
                <span>Timestamped ANPR plate verification</span>
              </li>
            </ul>
          </div>
          <div className="pt-6">
            <Link to="/citizen/login" className="w-full btn-secondary text-xs">
              Login to Inspect Evidence <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 3: Payments & QR Receipt */}
        <div className="gov-card-interactive p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#16856B] dark:text-[#34D399] border border-[#A7F3D0] dark:border-[#059669]/40 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#172033] dark:text-[#F1F5F9]">Digital Payment & QR Receipt</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
                Instant penalty clearance directly credited to the State Treasury.
              </p>
            </div>
            <ul className="text-xs text-[#172033] dark:text-[#F1F5F9] space-y-2.5">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
                <span>Scan & Pay via Google Pay, PhonePe, Paytm</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
                <span>Instant status clearance to PAID</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16856B] dark:text-[#34D399] flex-shrink-0" />
                <span>Download verified digital receipt with QR code</span>
              </li>
            </ul>
          </div>
          <div className="pt-6">
            <Link to="/citizen/signup" className="w-full btn-success text-xs">
              Register Vehicle Plate <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4-Step Pipeline Infographic */}
      <div className="gov-card p-8 space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-bold text-[#172033] dark:text-[#F1F5F9]">End-to-End Automated Workflow</h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
            How violations are captured, verified, and settled under the Motor Vehicles Act
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div className="p-5 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E3A8A] text-[#174EA6] dark:text-[#60A5FA] font-bold mx-auto flex items-center justify-center">
              1
            </div>
            <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">Footage Ingestion</h4>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              Live junction camera stream or officer uploaded footage fed into neural pipeline.
            </p>
          </div>

          <div className="p-5 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E3A8A] text-[#174EA6] dark:text-[#60A5FA] font-bold mx-auto flex items-center justify-center">
              2
            </div>
            <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">AI Detection & ANPR</h4>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              YOLOv8 classifies violation type; optical character recognition reads vehicle plate.
            </p>
          </div>

          <div className="p-5 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#FFFBEB] dark:bg-[#451A03] border border-[#FDE68A] dark:border-[#78350F] text-[#D97706] dark:text-[#FBBF24] font-bold mx-auto flex items-center justify-center">
              3
            </div>
            <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">Challan & Notice</h4>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              Challan registered in RTO repository; owner receives automated notice with OTP login.
            </p>
          </div>

          <div className="p-5 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#ECFDF5] dark:bg-[#064E3B]/40 border border-[#A7F3D0] dark:border-[#059669]/40 text-[#16856B] dark:text-[#34D399] font-bold mx-auto flex items-center justify-center">
              4
            </div>
            <h4 className="text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">Payment & QR Receipt</h4>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              Citizen views photo proof, pays via UPI, and receives scannable verified digital
              receipt.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EvidenceViewer
        isOpen={!!selectedForEvidence}
        onClose={() => setSelectedForEvidence(null)}
        challan={selectedForEvidence}
      />
      <PaymentModal
        isOpen={!!selectedForPayment}
        onClose={() => setSelectedForPayment(null)}
        challan={selectedForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />
      <QRReceiptModal
        isOpen={!!selectedForReceipt}
        onClose={() => setSelectedForReceipt(null)}
        challan={selectedForReceipt}
      />
      </div>
    </div>
  );
};
