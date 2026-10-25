import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Shield,
  Eye,
  AlertCircle,
  Building2,
  Car,
  Clock,
  MapPin,
  FileCheck,
  Send,
  XCircle,
  ChevronRight,
  RotateCcw,
  Check,
  ArrowRight,
  ShieldAlert,
  Video,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { EvidenceViewer } from '../citizen/EvidenceViewer';
import { LiveCameraCapture } from './LiveCameraCapture';

interface OfficerSummary {
  officer: {
    id: string;
    name: string;
    badge_number: string;
    email: string;
    station: string;
    jurisdiction: string;
    status: string;
  };
  violations_today: number;
  challans_today: number;
  pending_challans: number;
  paid_challans: number;
  overdue_challans: number;
}

interface RepeatViolator {
  vehicle_id: string;
  vehicle_number: string;
  vehicle_type: string;
  model: string;
  registered_owner: string;
  total_challans: number;
  paid_challans: number;
  pending_challans: number;
  total_pending_amount: number;
  enforcement_status: string;
  action_required: boolean;
}

export const OfficerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'capture' | 'enforcement' | 'challans' | 'history'>('capture');

  // Summary statistics & Profile
  const [summary, setSummary] = useState<OfficerSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Capture & Detection State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [captureSource, setCaptureSource] = useState<'live' | 'upload' | 'sample'>('upload');
  const [patrolLocation, setPatrolLocation] = useState<string>('FC Road Junction, Pune Central');
  const [manualPlate, setManualPlate] = useState<string>('');
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<any | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  // Repeat Violators (3+ Unpaid Challans)
  const [violators, setViolators] = useState<RepeatViolator[]>([]);
  const [loadingViolators, setLoadingViolators] = useState(false);

  // Enforcement Action Modal State
  const [actionModalVehicle, setActionModalVehicle] = useState<RepeatViolator | null>(null);
  const [actionType, setActionType] = useState('Physical Notice');
  const [actionLocation, setActionLocation] = useState('FC Road Junction Patrol Post');
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // All Challans State
  const [challansList, setChallansList] = useState<any[]>([]);
  const [loadingChallans, setLoadingChallans] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchPlate, setSearchPlate] = useState('');

  // Enforcement History State
  const [actionHistory, setActionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Proof Viewer Modal
  const [viewEvidenceChallan, setViewEvidenceChallan] = useState<any | null>(null);

  // Load summary on mount
  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await api.getOfficerSummary();
      setSummary(data);
    } catch (err: any) {
      const token = localStorage.getItem('auth_token');
      if (!token || token.startsWith('demo-') || err?.message?.includes('Not authenticated') || err?.message?.includes('401')) {
        navigate('/officer/login');
        return;
      }
      // Fallback display if summary error
      setSummary({
        officer: {
          id: user?.officerId || 'MH-OFF-1001',
          name: user?.fullName || 'Senior Inspector Vikas Deshmukh',
          badge_number: user?.badgeNumber || 'MH-TRF-1001',
          email: user?.email || 'officer@traffic.gov.in',
          station: user?.station || 'Central Traffic Division, Pune',
          jurisdiction: user?.jurisdiction || 'Zone 1 (Central Enforcement)',
          status: 'ACTIVE',
        },
        violations_today: 0,
        challans_today: 0,
        pending_challans: 3,
        paid_challans: 2,
        overdue_challans: 0,
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  // Load tab-specific data
  useEffect(() => {
    if (activeTab === 'enforcement') {
      fetchRepeatViolators();
    } else if (activeTab === 'challans') {
      fetchChallans();
    } else if (activeTab === 'history') {
      fetchActionHistory();
    }
  }, [activeTab, statusFilter]);

  const fetchRepeatViolators = async () => {
    setLoadingViolators(true);
    try {
      const data = await api.getRepeatViolators();
      setViolators(data);
    } catch {
      setViolators([]);
    } finally {
      setLoadingViolators(false);
    }
  };

  const fetchChallans = async () => {
    setLoadingChallans(true);
    try {
      const data = await api.getOfficerChallans(statusFilter, searchPlate);
      setChallansList(data);
    } catch {
      setChallansList([]);
    } finally {
      setLoadingChallans(false);
    }
  };

  const fetchActionHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await api.getEnforcementHistory();
      setActionHistory(data);
    } catch {
      setActionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle File Selection (Camera or Upload)
  // Handle File Selection (Camera or Upload)
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCapturedFile(file);
      setCapturedPreview(URL.createObjectURL(file));
      setIsLiveCameraOpen(false);
      setCaptureSource('upload');
      setDetectionResult(null);
      setDetectionError(null);
      // Automatically detect all vehicles and violations in uploaded photo
      handleSubmitForDetection(file);
    }
  };

  // Handle Live Camera Snapshot
  const handleLiveCapture = (file: File, previewUrl: string) => {
    setCapturedFile(file);
    setCapturedPreview(previewUrl);
    setIsLiveCameraOpen(false);
    setCaptureSource('live');
    handleSubmitForDetection(file);
  };

  // Handle Live Camera Continuous Detection Callback
  const handleLiveDetectionResult = useCallback((res: any, previewUrl: string, file: File) => {
    setDetectionResult(res);
    setCapturedPreview(previewUrl);
    setCapturedFile(file);
    setDetectionError(null);
    if (res.status === 'VIOLATION_DETECTED') {
      fetchSummary();
      fetchChallans();
    }
  }, []);

  // Retake photo (optionally re-open live camera stream)
  const handleRetake = (reopenLive: boolean = false) => {
    setCapturedFile(null);
    setCapturedPreview(null);
    setManualPlate('');
    setDetectionResult(null);
    setDetectionError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    setIsLiveCameraOpen(reopenLive);
  };

  // Load a pre-configured field sample image
  const handleLoadSample = async (samplePath: string, samplePlate?: string) => {
    try {
      const res = await fetch(samplePath);
      const blob = await res.blob();
      const file = new File([blob], samplePath.split('/').pop() || 'sample.jpg', { type: 'image/jpeg' });
      setCapturedFile(file);
      setCapturedPreview(samplePath);
      setIsLiveCameraOpen(false);
      setCaptureSource('sample');
      if (samplePlate) setManualPlate(samplePlate);
      setDetectionResult(null);
      setDetectionError(null);
      handleSubmitForDetection(file);
    } catch (err: any) {
      console.error('Failed to load sample', err);
    }
  };

  // Submit to Real AI Detection (Manual or Automatic)
  const handleSubmitForDetection = async (fileOverride?: any) => {
    const fileToSubmit = (fileOverride instanceof File) ? fileOverride : capturedFile;
    if (!fileToSubmit) return;

    setDetecting(true);
    setDetectionError(null);

    const formData = new FormData();
    formData.append('file', fileToSubmit);
    formData.append('location', patrolLocation);
    if (manualPlate.trim()) {
      formData.append('vehicle_plate', manualPlate.trim().toUpperCase());
    }

    try {
      const res = await api.captureAndDetectViolation(formData);
      setDetectionResult(res);
      // Refresh summary statistics after challan generation
      fetchSummary();
      fetchChallans();
    } catch (err: any) {
      setDetectionError(err.message || 'AI detection failed. Please check connection and try again.');
    } finally {
      setDetecting(false);
    }
  };

  // Record Enforcement Action
  const handleRecordAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModalVehicle) return;

    setSubmittingAction(true);
    try {
      const res = await api.recordEnforcementAction({
        vehicle_number: actionModalVehicle.vehicle_number,
        action_type: actionType,
        location: actionLocation,
        notes: actionNotes,
      });

      setActionSuccessMsg(
        `Action recorded successfully: ${res.action_type} for ${res.vehicle_number} (Ref #${res.id.slice(0, 8)})`
      );
      setTimeout(() => {
        setActionModalVehicle(null);
        setActionSuccessMsg(null);
        setActionNotes('');
        fetchRepeatViolators();
      }, 1800);
    } catch (err: any) {
      alert(err.message || 'Failed to record enforcement action.');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans text-[#172033] dark:text-[#F1F5F9] transition-colors duration-200">
      {/* 1. OFFICER PROFILE HEADER CARD */}
      <div className="gov-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFFBEB] dark:bg-[#451A03] border border-[#FDE68A] dark:border-[#78350F] text-[#D97706] dark:text-[#FBBF24] flex items-center justify-center flex-shrink-0 shadow-sm">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
                {summary?.officer.name || user?.fullName || 'Senior Inspector Vikas Deshmukh'}
              </h1>
              <span className="gov-badge-success">
                ● {summary?.officer.status || 'ACTIVE'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-1.5 mt-2.5 text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
              <div>
                Officer ID:{' '}
                <strong className="text-[#172033] dark:text-[#F1F5F9] font-mono">
                  {summary?.officer.badge_number || 'MH-TRF-1001'}
                </strong>
              </div>
              <div>
                Official Email:{' '}
                <strong className="text-[#172033] dark:text-[#F1F5F9]">
                  {summary?.officer.email || 'officer@traffic.gov.in'}
                </strong>
              </div>
              <div>
                Assigned Zone:{' '}
                <strong className="text-[#172033] dark:text-[#F1F5F9]">
                  {summary?.officer.jurisdiction || 'Zone 1 (Central)'}
                </strong>
              </div>
              <div>
                Station:{' '}
                <strong className="text-[#172033] dark:text-[#F1F5F9]">
                  {summary?.officer.station || 'Pune Central Division'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TODAY'S ACTIVITY STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="gov-card-interactive p-4 border-t-4 border-t-[#174EA6] dark:border-t-[#3B82F6]">
          <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
            Violations Today
          </span>
          <div className="text-2xl font-extrabold text-[#172033] dark:text-[#F1F5F9] mt-1 font-mono">
            {summary?.violations_today ?? 0}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 block">Logged by your patrol</span>
        </div>

        <div className="gov-card-interactive p-4 border-t-4 border-t-[#174EA6] dark:border-t-[#3B82F6]">
          <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
            Challans Generated
          </span>
          <div className="text-2xl font-extrabold text-[#174EA6] dark:text-[#60A5FA] mt-1 font-mono">
            {summary?.challans_today ?? 0}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 block">Department total today</span>
        </div>

        <div className="gov-card-interactive p-4 border-t-4 border-t-[#D97706] dark:border-t-[#F59E0B]">
          <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
            Pending Challans
          </span>
          <div className="text-2xl font-extrabold text-[#D97706] dark:text-[#FBBF24] mt-1 font-mono">
            {summary?.pending_challans ?? 0}
          </div>
          <span className="text-[11px] text-[#D97706] dark:text-[#FBBF24] mt-0.5 block">Awaiting citizen payment</span>
        </div>

        <div className="gov-card-interactive p-4 border-t-4 border-t-[#16856B] dark:border-t-[#10B981]">
          <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
            Paid Challans
          </span>
          <div className="text-2xl font-extrabold text-[#16856B] dark:text-[#34D399] mt-1 font-mono">
            {summary?.paid_challans ?? 0}
          </div>
          <span className="text-[11px] text-[#16856B] dark:text-[#34D399] mt-0.5 block">Successfully settled</span>
        </div>

        <div className="gov-card-interactive p-4 border-t-4 border-t-[#DC2626] dark:border-t-[#EF4444] col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
            Overdue (&gt;30d)
          </span>
          <div className="text-2xl font-extrabold text-[#DC2626] dark:text-[#F87171] mt-1 font-mono">
            {summary?.overdue_challans ?? 0}
          </div>
          <span className="text-[11px] text-[#DC2626] dark:text-[#F87171] mt-0.5 block">Action required</span>
        </div>
      </div>

      {/* 3. OPERATIONAL NAVIGATION TABS */}
      <div className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111C2E] rounded-t-xl px-2 flex items-center gap-2 overflow-x-auto text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveTab('capture')}
          className={`py-3 px-4 border-b-2 font-bold whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === 'capture'
              ? 'border-[#174EA6] dark:border-[#3B82F6] text-[#174EA6] dark:text-[#60A5FA] bg-[#EFF6FF]/60 dark:bg-[#1E3A8A]/30 rounded-t-lg'
              : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
          }`}
        >
          <Camera className="w-4 h-4" />
          Capture & AI Detection
        </button>

        <button
          onClick={() => setActiveTab('enforcement')}
          className={`py-3 px-4 border-b-2 font-bold whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === 'enforcement'
              ? 'border-[#DC2626] dark:border-[#EF4444] text-[#DC2626] dark:text-[#F87171] bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 rounded-t-lg'
              : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-[#DC2626] dark:text-[#F87171]" />
          3+ Unpaid Challans (Action Required)
          {violators.filter((v) => v.action_required).length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#DC2626] text-white font-mono">
              {violators.filter((v) => v.action_required).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('challans')}
          className={`py-3 px-4 border-b-2 font-bold whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === 'challans'
              ? 'border-[#174EA6] dark:border-[#3B82F6] text-[#174EA6] dark:text-[#60A5FA] bg-[#EFF6FF]/60 dark:bg-[#1E3A8A]/30 rounded-t-lg'
              : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
          }`}
        >
          <FileText className="w-4 h-4" />
          All Enforcement Citations
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-4 border-b-2 font-bold whitespace-nowrap transition flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-[#174EA6] dark:border-[#3B82F6] text-[#174EA6] dark:text-[#60A5FA] bg-[#EFF6FF]/60 dark:bg-[#1E3A8A]/30 rounded-t-lg'
              : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
          }`}
        >
          <Clock className="w-4 h-4" />
          Enforcement Action History
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CAPTURE VEHICLE VIOLATION & AI DETECTION */}
      {/* ========================================================================= */}
      {activeTab === 'capture' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Camera / Image Upload & Review */}
          <div className="lg:col-span-6 gov-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <div>
                <h3 className="font-bold text-[#172033] dark:text-[#F1F5F9] text-base">Capture Vehicle Violation</h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Take a photograph from camera or upload violation photo</p>
              </div>
              <span className="px-2 py-0.5 bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E3A8A] text-[#174EA6] dark:text-[#60A5FA] rounded text-[11px] font-semibold">
                Field Camera Ready
              </span>
            </div>

            {/* Hidden Inputs for Camera and File Picker */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelected}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelected}
              className="hidden"
            />

            {/* Patrol Location Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1">
                  Patrol Location / Junction Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={patrolLocation}
                    onChange={(e) => setPatrolLocation(e.target.value)}
                    placeholder="e.g. FC Road Junction, Pune"
                    className="gov-input pl-8 py-2 text-xs"
                  />
                  <MapPin className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1">
                  Vehicle Plate <span className="text-[#64748B] dark:text-[#94A3B8] font-normal">(Optional override)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualPlate}
                    onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                    placeholder="e.g. MH12DE1433"
                    className="gov-input font-mono uppercase py-2 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Live Camera Viewfinder OR Photo Upload / Review View */}
            {isLiveCameraOpen ? (
              <LiveCameraCapture
                onCapture={handleLiveCapture}
                onLiveDetectionResult={handleLiveDetectionResult}
                onClose={() => setIsLiveCameraOpen(false)}
                locationName={patrolLocation}
                manualPlate={manualPlate}
              />
            ) : !capturedPreview ? (
              <div className="border-2 border-dashed border-[#E2E8F0] dark:border-[#1E293B] rounded-xl p-6 text-center bg-[#F7F9FC] dark:bg-[#162238]/60 hover:bg-[#F1F5F9] dark:hover:bg-[#162238] transition space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#174EA6] to-[#0284C7] text-white mx-auto flex items-center justify-center shadow-md">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-bold text-[#172033] dark:text-[#F1F5F9] text-base">Capture Live Violation Image</h4>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-sm mx-auto">
                    Open the live patrol camera for automatic real-time detection, or upload existing photographic evidence.
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                  {/* 1. Live Camera Button */}
                  <button
                    type="button"
                    onClick={() => setIsLiveCameraOpen(true)}
                    className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md transition"
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                    </span>
                    <Camera className="w-4 h-4 text-amber-200" />
                    Open Live Camera
                  </button>

                  {/* 2. Device System Camera */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="btn-secondary w-full sm:w-auto px-4 py-3 text-xs"
                  >
                    <Video className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
                    Device Camera App
                  </button>

                  {/* 3. Upload from Gallery */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary w-full sm:w-auto px-4 py-3 text-xs"
                  >
                    <Upload className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
                    Upload Photo
                  </button>
                </div>

                {/* Quick Test Evidence Samples */}
                <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] text-left">
                  <span className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-2">
                    Quick Field Test Samples:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadSample('/samples/helmet_violation.jpg', 'MH12DE1433')}
                      className="p-2 rounded-lg bg-white dark:bg-[#111C2E] hover:bg-[#F7F9FC] dark:hover:bg-[#162238] border border-[#E2E8F0] dark:border-[#1E293B] text-left text-[11px] font-semibold text-[#172033] dark:text-[#F1F5F9] transition flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      No Helmet Sample
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSample('/samples/triple_riding.jpg', 'MH14EU8921')}
                      className="p-2 rounded-lg bg-white dark:bg-[#111C2E] hover:bg-[#F7F9FC] dark:hover:bg-[#162238] border border-[#E2E8F0] dark:border-[#1E293B] text-left text-[11px] font-semibold text-[#172033] dark:text-[#F1F5F9] transition flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Triple Riding Sample
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSample('/samples/clear_plate.jpg', 'MH37AB0940')}
                      className="p-2 rounded-lg bg-white dark:bg-[#111C2E] hover:bg-[#F7F9FC] dark:hover:bg-[#162238] border border-[#E2E8F0] dark:border-[#1E293B] text-left text-[11px] font-semibold text-[#172033] dark:text-[#F1F5F9] transition flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Clear Plate Sample
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#1E293B] bg-slate-950 aspect-[4/3] flex items-center justify-center">
                  <img
                    src={capturedPreview}
                    alt="Captured Traffic Violation"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/75 backdrop-blur-sm rounded-md text-[11px] text-white font-mono flex items-center gap-1.5 shadow">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {captureSource === 'live' ? 'Live Camera Snapshot' : 'Photo Evidence Ready'}
                    </span>
                  </div>
                  {captureSource === 'live' && (
                    <div className="absolute top-2 right-2 px-2.5 py-1 bg-red-600/95 text-white rounded text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Live Capture
                    </div>
                  )}
                </div>

                {/* Retake and Submit Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={detecting}
                      onClick={() => handleRetake(true)}
                      className="btn-secondary flex-1 py-2.5 px-3 text-xs"
                      title="Click new live photo"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-500" />
                      Click Live Image
                    </button>
                    <button
                      type="button"
                      disabled={detecting}
                      onClick={() => handleRetake(false)}
                      className="btn-secondary py-2.5 px-3 text-xs"
                      title="Clear photo"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={detecting}
                    onClick={handleSubmitForDetection}
                    className="btn-primary py-2.5 px-4 text-xs tracking-wider"
                  >
                    {detecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Running AI Detection...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        Submit for AI Detection
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {detectionError && (
              <div className="p-3.5 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 rounded-xl text-[#DC2626] dark:text-[#F87171] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#F87171] flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{detectionError}</p>
              </div>
            )}
          </div>

          {/* Right Column: AI Detection Result & Auto Challan */}
          <div className="lg:col-span-6 gov-card p-5 space-y-4">
            <div className="border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#172033] dark:text-[#F1F5F9] text-base">AI Detection Result</h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Automated classification, OCR plate reading & database verification</p>
              </div>
              {detectionResult && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    detectionResult.status === 'VIOLATION_DETECTED'
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      : detectionResult.status === 'DUPLICATE_PREVENTED'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                      : detectionResult.status === 'PLATE_NOT_FOUND'
                      ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {detectionResult.status === 'VIOLATION_DETECTED'
                    ? 'Violation Detected'
                    : detectionResult.status === 'DUPLICATE_PREVENTED'
                    ? 'Duplicate Prevented'
                    : detectionResult.status === 'PLATE_NOT_FOUND'
                    ? 'Plate Verification Needed'
                    : 'Inspection Complete'}
                </span>
              )}
            </div>

            {/* When no analysis has run yet */}
            {!detectionResult && !detecting && (
              <div className="py-16 text-center text-[#64748B] dark:text-[#94A3B8] space-y-2">
                <Car className="w-12 h-12 mx-auto text-[#CBD5E1] dark:text-[#475569]" />
                <p className="text-sm font-semibold text-[#172033] dark:text-[#F1F5F9]">Awaiting Violation Submission</p>
                <p className="text-xs max-w-xs mx-auto text-[#64748B] dark:text-[#94A3B8]">
                  Capture or select an image on the left and click "Submit for AI Detection".
                </p>
              </div>
            )}

            {/* Analyzing Spinner */}
            {detecting && (
              <div className="py-16 text-center space-y-4">
                <RefreshCw className="w-10 h-10 mx-auto text-[#174EA6] dark:text-[#3B82F6] animate-spin" />
                <div>
                  <h4 className="font-bold text-[#172033] dark:text-[#F1F5F9] text-sm">Processing Evidence in AI Pipeline</h4>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                    Detecting all vehicles in frame, analyzing individual violations (Helmet, Triple Riding, Wrong Side), and recognizing license plates independently...
                  </p>
                </div>
              </div>
            )}

            {/* RESULT CASE 1: NO VIOLATION DETECTED */}
            {detectionResult && detectionResult.status === 'NO_VIOLATION' && (
              <div className="p-6 text-center space-y-4 bg-[#F7F9FC] dark:bg-[#162238]/60 border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl">
                <div className="w-12 h-12 rounded-full bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA] mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-[#172033] dark:text-[#F1F5F9] text-sm">
                    No traffic violation detected.
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-sm mx-auto">
                    {detectionResult.total_vehicles_detected ? `${detectionResult.total_vehicles_detected} vehicle(s) analyzed in frame. ` : ''}
                    All detected vehicles are compliant with traffic rules. No challan was created.
                  </p>
                </div>

                {detectionResult.processing_time_ms && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] rounded-full text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                    <span>⚡ AI Latency: {detectionResult.processing_time_ms}ms</span>
                    {detectionResult.inference_time_ms && (
                      <span className="text-[#94A3B8] dark:text-[#64748B]">
                        (Inference: {detectionResult.inference_time_ms}ms • OCR: {detectionResult.ocr_time_ms}ms)
                      </span>
                    )}
                  </div>
                )}

                {detectionResult.clean_vehicles && detectionResult.clean_vehicles.length > 0 && (
                  <div className="pt-2 text-left space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-center">
                      Detected Vehicles & Recognized Number Plates:
                    </span>
                    <div className="flex flex-wrap justify-center gap-2">
                      {detectionResult.clean_vehicles.map((cv: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-white dark:bg-[#0D1524] border border-emerald-300 dark:border-emerald-800 rounded font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-sm flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="capitalize text-slate-700 dark:text-slate-300 font-sans font-semibold">
                            {cv.vehicle_type}:
                          </span>
                          <span>
                            {cv.plate_number && cv.plate_number !== 'Clean / Compliant' && cv.plate_number !== 'Unreadable / Review'
                              ? cv.plate_number
                              : 'Plate Not Detected'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(!detectionResult.clean_vehicles || detectionResult.clean_vehicles.length === 0) &&
                  detectionResult.plate_number && detectionResult.plate_number !== 'Not Detected' && (
                    <div className="inline-block px-3 py-1 bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] rounded font-mono text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">
                      Plate Read: {detectionResult.plate_number}
                    </div>
                  )}
              </div>
            )}

            {/* RESULT CASE 2: DUPLICATE PREVENTED */}
            {detectionResult && detectionResult.status === 'DUPLICATE_PREVENTED' && (
              <div className="p-5 bg-[#FFFBEB] dark:bg-[#451A03]/30 border border-[#FDE68A] dark:border-[#78350F] rounded-xl space-y-3 text-xs">
                <div className="flex items-center gap-2 text-[#D97706] dark:text-[#FBBF24] font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24]" />
                  {detectionResult.message}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[#172033] dark:text-[#F1F5F9] pt-1">
                  <div>
                    Existing Challan ID: <strong className="font-mono">{detectionResult.challan_id}</strong>
                  </div>
                  <div>
                    Vehicle Number: <strong className="font-mono">{detectionResult.vehicle_number}</strong>
                  </div>
                  <div>
                    Fine Amount: <strong>₹{detectionResult.fine_amount}</strong>
                  </div>
                  <div>
                    Violation: <strong>{detectionResult.violation}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* RESULT CASE 3: VIOLATION DETECTED & CHALLAN GENERATED */}
            {detectionResult && detectionResult.status === 'VIOLATION_DETECTED' && (
              <div className="space-y-4">

                {/* Multi-Vehicle Frame Summary Banner */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-sm text-[#174EA6] dark:text-[#60A5FA] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Frame Analysis: {detectionResult.total_vehicles_detected || (detectionResult.vehicles?.length || 1)} Vehicle(s) Detected
                    </span>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      {detectionResult.total_challans_created || detectionResult.violations?.length || 1} violation challan(s) automatically issued • Total fine: ₹{detectionResult.total_fine_amount}
                    </p>
                  </div>
                  {detectionResult.processing_time_ms && (
                    <div className="text-right text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                      ⚡ {detectionResult.processing_time_ms}ms
                      {detectionResult.inference_time_ms && (
                        <span className="block text-[10px] text-[#94A3B8] dark:text-[#64748B]">
                          Inf: {detectionResult.inference_time_ms}ms | OCR: {detectionResult.ocr_time_ms}ms
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Per-Vehicle Cards */}
                {(detectionResult.vehicles && detectionResult.vehicles.length > 0
                  ? detectionResult.vehicles
                  : [detectionResult]
                ).map((veh: any, vIdx: number) => (
                  <div
                    key={vIdx}
                    className="p-4 bg-[#F7F9FC] dark:bg-[#162238]/60 border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl space-y-3"
                  >
                    {/* Vehicle Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#174EA6] text-white rounded text-[11px] font-bold uppercase">
                          Vehicle #{veh.vehicle_id || vIdx + 1}: {veh.vehicle_type}
                        </span>
                        <span className="font-mono font-bold text-sm bg-white dark:bg-[#0D1524] px-2.5 py-0.5 border border-[#E2E8F0] dark:border-[#1E293B] rounded shadow-sm text-[#172033] dark:text-[#F1F5F9]">
                          {veh.vehicle_number}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#DC2626] dark:text-[#F87171]">
                        Fine: ₹{veh.total_fine_amount}
                      </span>
                    </div>

                    {/* Owner Details */}
                    {veh.owner_summary && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#172033] dark:text-[#F1F5F9] pt-1 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                        <div>
                          Registered Owner: <strong>{veh.owner_summary.registered_owner}</strong>
                        </div>
                        <div>
                          Vehicle Class: <strong>{veh.vehicle_type}</strong>
                        </div>
                        <div>
                          Unpaid Challans:{' '}
                          <strong className="font-mono font-bold text-[#D97706] dark:text-[#FBBF24]">
                            {veh.owner_summary.total_pending_challans}
                          </strong>
                        </div>
                        <div>
                          Enforcement Flag:{' '}
                          <strong
                            className={
                              veh.owner_summary.enforcement_status === 'ACTION REQUIRED'
                                ? 'text-red-700 dark:text-red-400 font-bold'
                                : 'text-emerald-700 dark:text-emerald-400 font-bold'
                            }
                          >
                            {veh.owner_summary.enforcement_status}
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* Violations for this vehicle */}
                    <div className="space-y-1.5 pt-1">
                      {veh.violations?.map((v: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-[#DC2626] dark:text-[#F87171] flex items-center gap-1.5">
                              <span>✓</span>
                              {v.violation_name}
                            </div>
                            <span className="text-[11px] text-[#DC2626] dark:text-[#F87171]/80 font-medium">
                              Section: {v.legal_section} • Confidence: <strong>{v.confidence}%</strong>
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[#DC2626] dark:text-[#F87171] font-mono text-sm block">
                              ₹{v.fine_amount}
                            </span>
                            <span className="text-[10px] text-[#DC2626] dark:text-[#F87171]/80 font-mono">
                              Challan: {v.challan_id ? v.challan_id.slice(0, 8) : '...'}...
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Auto Challan Confirmation for this vehicle */}
                    <div className="p-3 bg-[#ECFDF5] dark:bg-[#064E3B]/30 border border-[#A7F3D0] dark:border-[#059669]/40 rounded-lg space-y-1.5 text-xs text-[#16856B] dark:text-[#34D399]">
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Official E-Challan Generated (Status: UNPAID)
                        </span>
                        <span className="font-mono text-[11px]">
                          ID: {(veh.primary_challan_id || veh.challan_id || '').slice(0, 8)}...
                        </span>
                      </div>
                      <div className="text-[11px] text-[#172033] dark:text-[#F1F5F9]">
                        Email Notice:{' '}
                        {veh.email_status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded text-[10px]">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Sent {veh.recipient_email ? `(${veh.recipient_email})` : ''}
                          </span>
                        ) : veh.email_status === 'failed' ? (
                          <span
                            className="inline-flex items-center gap-1 font-bold text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 px-2 py-0.5 rounded text-[10px]"
                            title={veh.email_error || 'SMTP delivery failed'}
                          >
                            <AlertCircle className="w-2.5 h-2.5" />
                            Failed to send
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#64748B] dark:text-[#94A3B8] bg-[#F7F9FC] dark:bg-[#162238] border border-[#E2E8F0] dark:border-[#1E293B] px-2 py-0.5 rounded text-[10px]">
                            Not available (No registered owner email)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Unreadable Vehicles Requiring Verification in the same frame */}
                {detectionResult.unreadable_vehicles && detectionResult.unreadable_vehicles.length > 0 && (
                  <div className="p-4 bg-[#FFFBEB] dark:bg-[#451A03]/30 border border-[#FDE68A] dark:border-[#78350F] rounded-xl space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-[#D97706] dark:text-[#FBBF24] font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {detectionResult.unreadable_vehicles.length} Vehicle(s) Requiring License Plate Verification:
                    </div>
                    {detectionResult.unreadable_vehicles.map((uv: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white dark:bg-[#111C2E] rounded-lg border border-[#FDE68A] dark:border-[#78350F] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#172033] dark:text-[#F1F5F9] uppercase">
                            Vehicle #{uv.vehicle_id || idx + 1}: {uv.vehicle_type}
                          </span>
                          <div className="flex gap-1">
                            {uv.violations?.map((viol: string) => (
                              <span key={viol} className="px-1.5 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 rounded text-[10px] font-bold uppercase">
                                {viol.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualPlate}
                            onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                            placeholder="Enter plate (e.g. MH12DE1433)"
                            className="gov-input flex-1 font-mono font-bold text-xs uppercase py-1.5"
                          />
                          <button
                            type="button"
                            disabled={!manualPlate.trim() || detecting}
                            onClick={handleSubmitForDetection}
                            className="btn-primary px-3 py-1.5 text-xs"
                          >
                            <Check className="w-3 h-3" />
                            {detecting ? 'Issuing...' : 'Confirm Plate & Issue'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Clean Vehicles Notice */}
                {detectionResult.clean_vehicles && detectionResult.clean_vehicles.length > 0 && (
                  <div className="p-3 bg-white dark:bg-[#0D1524] border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      {detectionResult.clean_vehicles.length} vehicle(s) in frame compliant with no traffic violations
                    </span>
                    <div className="flex gap-1.5">
                      {detectionResult.clean_vehicles.map((cv: any, idx: number) => (
                        <span key={idx} className="font-mono text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {cv.vehicle_type}: {cv.plate_number}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action after generation */}
                <button
                  type="button"
                  onClick={() => handleRetake(true)}
                  className="btn-secondary w-full py-2.5 text-center text-xs font-bold"
                >
                  Capture Next Frame
                </button>

              </div>
            )}

            {/* RESULT CASE 4: PLATE NOT FOUND BUT VIOLATION DETECTED */}
            {detectionResult && detectionResult.status === 'PLATE_NOT_FOUND' && (
              <div className="p-5 bg-[#FFFBEB] dark:bg-[#451A03]/30 border border-[#FDE68A] dark:border-[#78350F] rounded-xl space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#D97706] dark:text-[#FBBF24] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-[#172033] dark:text-[#F1F5F9]">
                      Traffic Violation Detected by AI ({detectionResult.total_vehicles_detected || 1} Vehicle(s) Detected)
                    </h4>
                    <p className="text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
                      {detectionResult.message}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {detectionResult.violations_detected?.map((v: string) => (
                        <span
                          key={v}
                          className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 font-bold text-[11px] uppercase border border-red-200 dark:border-red-800"
                        >
                          {v.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {detectionResult.processing_time_ms && (
                  <div className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                    ⚡ AI Latency: {detectionResult.processing_time_ms}ms
                  </div>
                )}

                <div className="p-4 bg-white dark:bg-[#111C2E] rounded-xl border border-[#FDE68A] dark:border-[#78350F] space-y-2.5">
                  <label className="block text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">
                    Verify & Confirm Vehicle License Plate:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={manualPlate}
                      onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                      placeholder="e.g. MH12DE1433"
                      className="gov-input flex-1 font-mono font-bold text-sm uppercase py-2"
                    />
                    <button
                      type="button"
                      disabled={!manualPlate.trim() || detecting}
                      onClick={handleSubmitForDetection}
                      className="btn-primary px-4 py-2 text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {detecting ? 'Generating...' : 'Confirm & Issue Challan'}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Entering the license plate allows the system to match the RTO registry and generate the official E-Challan with photo evidence.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REPEAT VIOLATORS & 3+ UNPAID CHALLANS ENFORCEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'enforcement' && (
        <div className="gov-card overflow-hidden">
          <div className="p-5 border-b border-[#E2E8F0] dark:border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#172033] dark:text-[#F1F5F9] text-base">Field Enforcement & Repeat Violators</h3>
                <span className="px-2 py-0.5 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 text-[#DC2626] dark:text-[#F87171] border border-[#FECACA] dark:border-[#DC2626]/40 rounded text-xs font-bold">
                  Rule: 3+ Unpaid = Action Required
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                Vehicles with multiple unpaid citations requiring authorized on-road police enforcement action
              </p>
            </div>

            <button
              onClick={fetchRepeatViolators}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh List
            </button>
          </div>

          {loadingViolators ? (
            <div className="p-12 text-center text-[#64748B] dark:text-[#94A3B8]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#174EA6] dark:text-[#3B82F6] mb-2" />
              <p className="text-xs">Evaluating unpaid citations in database...</p>
            </div>
          ) : violators.length === 0 ? (
            <div className="p-12 text-center text-[#64748B] dark:text-[#94A3B8] text-xs">
              No repeat violators found in the system registry.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#F7F9FC] dark:bg-[#162238] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Vehicle Number</th>
                    <th className="py-3 px-4">Registered Owner</th>
                    <th className="py-3 px-4 text-center">Total Challans</th>
                    <th className="py-3 px-4 text-center">Paid</th>
                    <th className="py-3 px-4 text-center">Unpaid / Pending</th>
                    <th className="py-3 px-4">Pending Fine</th>
                    <th className="py-3 px-4">Enforcement Status</th>
                    <th className="py-3 px-4 text-right">Authorized Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#172033] dark:text-[#F1F5F9]">
                  {violators.map((v) => (
                    <tr
                      key={v.vehicle_id}
                      className={v.action_required ? 'bg-[#FEF2F2]/40 dark:bg-[#7F1D1D]/20 hover:bg-[#FEF2F2] dark:hover:bg-[#7F1D1D]/30' : 'hover:bg-[#F7F9FC] dark:hover:bg-[#162238]/60'}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                        {v.vehicle_number}
                        <span className="block text-[11px] font-normal text-[#64748B] dark:text-[#94A3B8] font-sans">
                          {v.vehicle_type} • {v.model}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#172033] dark:text-[#F1F5F9]">
                        {v.registered_owner}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-medium">
                        {v.total_challans}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-[#16856B] dark:text-[#34D399]">
                        {v.paid_challans}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-[#DC2626] dark:text-[#F87171]">
                        {v.pending_challans}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                        ₹{v.total_pending_amount}
                      </td>
                      <td className="py-3.5 px-4">
                        {v.action_required ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#FEF2F2] dark:bg-[#7F1D1D]/40 text-[#DC2626] dark:text-[#F87171] border border-[#FECACA] dark:border-[#DC2626]/40 animate-pulse">
                            ⚠️ ACTION REQUIRED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#F7F9FC] dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8]">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {v.action_required ? (
                          <button
                            onClick={() => {
                              setActionModalVehicle(v);
                              setActionLocation(patrolLocation);
                              setActionNotes(
                                `Vehicle has ${v.pending_challans} unpaid traffic violations totaling ₹${v.total_pending_amount}. Immediate field notice issued.`
                              );
                            }}
                            className="btn-danger py-1.5 px-3 text-xs inline-flex items-center gap-1.5"
                          >
                            <Shield className="w-3.5 h-3.5" /> Initiate Action
                          </button>
                        ) : (
                          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">No action needed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ALL ACTIVE CHALLANS TABLE */}
      {/* ========================================================================= */}
      {activeTab === 'challans' && (
        <div className="gov-card overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-4">
            <div>
              <h3 className="font-bold text-[#172033] dark:text-[#F1F5F9] text-base">Enforcement Citation Monitoring</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Search and audit official challans across jurisdictions</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Status filter */}
              <div className="flex rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden text-xs">
                {['ALL', 'PENDING', 'PAID'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`py-1.5 px-3 font-semibold transition ${
                      statusFilter === st
                        ? 'bg-[#174EA6] dark:bg-[#3B82F6] text-white'
                        : 'bg-white dark:bg-[#111C2E] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F7F9FC] dark:hover:bg-[#162238]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Plate Search */}
              <div className="flex">
                <input
                  type="text"
                  placeholder="Filter Plate..."
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchChallans()}
                  className="gov-input rounded-r-none uppercase font-mono py-1.5 text-xs"
                />
                <button
                  onClick={fetchChallans}
                  className="btn-primary rounded-l-none text-xs px-3"
                >
                  Search
                </button>
              </div>
            </div>
          </div>

          {loadingChallans ? (
            <div className="p-12 text-center text-[#64748B] dark:text-[#94A3B8]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#174EA6] dark:text-[#3B82F6] mb-2" />
              <p className="text-xs">Loading citation records...</p>
            </div>
          ) : challansList.length === 0 ? (
            <div className="p-12 text-center text-[#64748B] dark:text-[#94A3B8] text-xs">
              No citations found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#F7F9FC] dark:bg-[#162238] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Challan ID</th>
                    <th className="py-3 px-4">Plate No</th>
                    <th className="py-3 px-4">Violation</th>
                    <th className="py-3 px-4">Fine</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4 text-right">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#172033] dark:text-[#F1F5F9]">
                  {challansList.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F7F9FC] dark:hover:bg-[#162238]/60">
                      <td className="py-3 px-4 font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                        {c.id.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#174EA6] dark:text-[#60A5FA]">
                        {c.vehicle_number}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#172033] dark:text-[#F1F5F9]">
                        {c.violation}
                        <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">{c.legal_section}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                        ₹{c.fine_amount}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            c.status === 'paid'
                              ? 'gov-badge-success'
                              : 'gov-badge-warning'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                        {c.location}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
                        {new Date(c.violation_datetime).toLocaleDateString()}{' '}
                        {new Date(c.violation_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.evidence_url ? (
                          <button
                            onClick={() =>
                              setViewEvidenceChallan({
                                id: c.id,
                                vehiclePlate: c.vehicle_number,
                                violation: c.violation,
                                fineAmount: c.fine_amount,
                                evidenceUrl: c.evidence_url,
                              })
                            }
                            className="p-1.5 rounded-lg bg-[#F7F9FC] dark:bg-[#162238] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA] border border-[#E2E8F0] dark:border-[#1E293B] transition"
                            title="Inspect photographic evidence"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[#64748B] dark:text-[#94A3B8] text-xs">No image</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ENFORCEMENT ACTION HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="gov-card p-5 space-y-4">
          <div className="border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#172033] dark:text-[#F1F5F9] text-base">Recorded Enforcement Actions Log</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Auditable history of field warnings, court summons, and tow orders</p>
            </div>
            <button
              onClick={fetchActionHistory}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div className="p-12 text-center text-[#64748B] dark:text-[#94A3B8]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#174EA6] dark:text-[#3B82F6] mb-2" />
              <p className="text-xs">Loading enforcement logs...</p>
            </div>
          ) : actionHistory.length === 0 ? (
            <div className="p-12 text-center text-[#64748B] dark:text-[#94A3B8] text-xs">
              No field enforcement actions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#F7F9FC] dark:bg-[#162238] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Action ID</th>
                    <th className="py-3 px-4">Officer</th>
                    <th className="py-3 px-4">Vehicle Number</th>
                    <th className="py-3 px-4">Action Type</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#172033] dark:text-[#F1F5F9]">
                  {actionHistory.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F7F9FC] dark:hover:bg-[#162238]/60">
                      <td className="py-3 px-4 font-mono font-bold text-[#172033] dark:text-[#F1F5F9]">
                        {a.id.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-4 font-medium text-[#172033] dark:text-[#F1F5F9]">
                        {a.officer_name} ({a.officer_badge})
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#174EA6] dark:text-[#60A5FA]">
                        {a.vehicle_number}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#172033] dark:text-[#F1F5F9]">
                        {a.action_type}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
                        {a.location || 'Patrol Post'}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#64748B] dark:text-[#94A3B8] max-w-xs truncate">
                        {a.notes}
                      </td>
                      <td className="py-3 px-4">
                        <span className="gov-badge-info">
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
                        {new Date(a.created_at).toLocaleDateString()}{' '}
                        {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INITIATE AUTHORIZED ENFORCEMENT ACTION (Section 11) */}
      {/* ========================================================================= */}
      {actionModalVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl shadow-2xl max-w-lg w-full border border-[#E2E8F0] dark:border-[#1E293B] p-6 space-y-4 text-[#172033] dark:text-[#F1F5F9]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <div className="flex items-center gap-2 text-[#DC2626] dark:text-[#F87171] font-bold text-base">
                <ShieldAlert className="w-5 h-5 text-[#DC2626] dark:text-[#F87171]" />
                Authorized Traffic Enforcement Action
              </div>
              <button
                onClick={() => setActionModalVehicle(null)}
                className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {actionSuccessMsg ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-[#16856B] dark:text-[#34D399] mx-auto" />
                <p className="font-bold text-[#172033] dark:text-[#F1F5F9] text-sm">{actionSuccessMsg}</p>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Enforcement history updated in state database.</p>
              </div>
            ) : (
              <form onSubmit={handleRecordAction} className="space-y-4 text-xs sm:text-sm">
                <div className="p-3 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#DC2626]/40 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between font-bold text-[#DC2626] dark:text-[#F87171]">
                    <span>Vehicle: {actionModalVehicle.vehicle_number}</span>
                    <span>Total Unpaid: {actionModalVehicle.pending_challans} (₹{actionModalVehicle.total_pending_amount})</span>
                  </div>
                  <p className="text-[#DC2626] dark:text-[#F87171]/90">
                    Registered Owner: <strong>{actionModalVehicle.registered_owner}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1 text-xs">
                    Action Type <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="gov-select text-xs"
                  >
                    <option value="Physical Notice">Physical Notice (On-road Warning & Demand to Settle)</option>
                    <option value="Warning Notice">Official Written Warning Citation</option>
                    <option value="Tow / Impound Request">Tow / Vehicle Impound Recommendation</option>
                    <option value="Court Summons">Court Summons / Special Judicial Referral</option>
                    <option value="Vehicle Immobilization Notice">Vehicle Wheel-Clamp / Immobilization Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1 text-xs">
                    Enforcement Location / Post
                  </label>
                  <input
                    type="text"
                    required
                    value={actionLocation}
                    onChange={(e) => setActionLocation(e.target.value)}
                    className="gov-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#172033] dark:text-[#F1F5F9] font-semibold mb-1 text-xs">
                    Officer Notes / Operational Reason
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Enter observations, location details, or citation notices..."
                    className="gov-input text-xs resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => setActionModalVehicle(null)}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="btn-danger text-xs py-2 px-4"
                  >
                    {submittingAction ? 'Recording...' : 'Record Enforcement Action'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Proof Evidence Viewer Modal */}
      <EvidenceViewer
        isOpen={!!viewEvidenceChallan}
        onClose={() => setViewEvidenceChallan(null)}
        challan={viewEvidenceChallan}
      />

    </div>
  );
};
