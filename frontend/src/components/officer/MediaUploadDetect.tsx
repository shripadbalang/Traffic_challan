import React, { useState } from 'react';
import {
  UploadCloud,
  FileVideo,
  Camera,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Send,
  Sparkles,
  RefreshCw,
  Phone,
  User,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { DetectionResult, Vehicle, Challan } from '../../types';
import { Badge } from '../common/Badge';

export interface MediaUploadDetectProps {
  onChallanIssued?: (challan: Challan) => void;
}

export const MediaUploadDetect: React.FC<MediaUploadDetectProps> = ({
  onChallanIssued,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80'
  );
  const [locationName, setLocationName] = useState('FC Road Junction near Goodluck Cafe, Pune');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issuedNotification, setIssuedNotification] = useState<{
    challanId: string;
    ownerName: string;
    mobile: string;
  } | null>(null);

  // Sample Presets for instantaneous testing
  const samplePresets = [
    {
      title: 'Preset 1: Helmet Violation',
      url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80',
      location: 'FC Road Junction (Pune)',
      plate: 'MH12DE1433',
      violationCode: 'NO_HELMET',
      violationName: 'Riding without helmet',
      fine: 500,
      confidence: 0.96,
      plateConfidence: 0.98,
      boxes: [
        { label: 'No Helmet: 96%', confidence: 0.96, box: [14, 38, 40, 62] as [number, number, number, number], color: '#ef4444' },
        { label: 'Plate: MH12DE1433 (98%)', confidence: 0.98, box: [68, 42, 84, 58] as [number, number, number, number], color: '#3b82f6' },
      ],
    },
    {
      title: 'Preset 2: Wrong Side Driving',
      url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=900&q=80',
      location: 'Bandra-Kurla Complex Flyover (Mumbai)',
      plate: 'MH14EU8921',
      violationCode: 'WRONG_SIDE_DRIVING',
      violationName: 'Wrong-side / against traffic driving',
      fine: 1500,
      confidence: 0.94,
      plateConfidence: 0.95,
      boxes: [
        { label: 'Against Traffic Flow (94%)', confidence: 0.94, box: [22, 28, 78, 72] as [number, number, number, number], color: '#dc2626' },
        { label: 'Plate: MH14EU8921 (95%)', confidence: 0.95, box: [65, 38, 80, 58] as [number, number, number, number], color: '#3b82f6' },
      ],
    },
    {
      title: 'Preset 3: Triple Riding',
      url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=900&q=80',
      location: 'Marine Drive Promenade (Mumbai)',
      plate: 'MH02CD4590',
      violationCode: 'TRIPLE_RIDING',
      violationName: 'Triple riding on two-wheeler',
      fine: 1000,
      confidence: 0.91,
      plateConfidence: 0.94,
      boxes: [
        { label: 'Triple Riding (91%)', confidence: 0.91, box: [18, 32, 68, 74] as [number, number, number, number], color: '#eab308' },
        { label: 'Plate: MH02CD4590 (94%)', confidence: 0.94, box: [72, 40, 86, 56] as [number, number, number, number], color: '#3b82f6' },
      ],
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setIssuedNotification(null);
    }
  };

  const handleSelectPreset = (preset: typeof samplePresets[0]) => {
    setPreviewUrl(preset.url);
    setLocationName(preset.location);
    setSelectedFile(null);
    setResult(null);
    setIssuedNotification(null);
  };

  const handleRunAiAnalysis = async () => {
    setAnalyzing(true);
    setResult(null);
    setIssuedNotification(null);

    // Simulated multi-stage AI pipeline
    setAnalysisStep('1. Running YOLOv8 Traffic Model on visual frames...');
    await new Promise((r) => setTimeout(r, 600));

    setAnalysisStep('2. Detecting violation class (Helmet / Speed / Vector)...');
    await new Promise((r) => setTimeout(r, 600));

    setAnalysisStep('3. Applying ANPR (Automatic Number Plate Recognition) OCR...');
    await new Promise((r) => setTimeout(r, 600));

    setAnalysisStep('4. Querying Vahan / State RTO Vehicle Database...');
    await new Promise((r) => setTimeout(r, 500));

    // Match preset or fallback
    const matchedPreset = samplePresets.find((p) => p.url === previewUrl) || samplePresets[0];
    const vehicle = await api.lookupVehicle(matchedPreset.plate);

    setResult({
      message: `Violation Detected: ${matchedPreset.violationName}`,
      plateNumber: matchedPreset.plate,
      plateConfidence: matchedPreset.plateConfidence,
      violationsFound: [matchedPreset.violationCode],
      boxes: matchedPreset.boxes,
      evidenceUrl: previewUrl || matchedPreset.url,
      matchedVehicle: vehicle || {
        id: 999,
        plateNumber: matchedPreset.plate,
        vehicleType: 'Two Wheeler (Motorcycle)',
        model: 'Honda Activa 6G',
        rtoCode: 'MH-12 (Pune)',
        ownerName: 'Rajesh Sharma',
        ownerMobile: '9822012345',
      },
    });

    setAnalyzing(false);
  };

  const handleIssueChallan = async () => {
    if (!result) return;
    setIssuing(true);

    try {
      const matchedPreset = samplePresets.find((p) => p.plate === result.plateNumber) || samplePresets[0];

      const res = await api.issueChallan({
        plateNumber: result.plateNumber,
        violationCode: matchedPreset.violationCode,
        violationName: matchedPreset.violationName,
        fineAmount: matchedPreset.fine,
        location: locationName,
        evidenceUrl: result.evidenceUrl,
        annotations: result.boxes,
        aiConfidence: matchedPreset.confidence,
        detectionSource: 'ai',
      });

      setIssuedNotification({
        challanId: res.challan.id,
        ownerName: result.matchedVehicle?.ownerName || 'Vehicle Owner',
        mobile: result.matchedVehicle?.ownerMobile || '9822012345',
      });

      if (onChallanIssued) {
        onChallanIssued(res.challan);
      }
    } catch {
      alert('Failed to issue challan.');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-[#172033] dark:text-[#F1F5F9]">
      {/* Success Notification Banner on Challan Generation */}
      {issuedNotification && (
        <div className="p-4 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 border border-[#A7F3D0] dark:border-[#059669]/40 text-[#16856B] dark:text-[#34D399] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#16856B]/20 text-[#16856B] dark:text-[#34D399]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-[#172033] dark:text-[#F1F5F9] text-sm">
                E-Challan {issuedNotification.challanId} Generated & Dispatched!
              </h4>
              <p className="text-xs text-[#16856B] dark:text-[#34D399] mt-0.5">
                Instant SMS alert with payment link dispatched to{' '}
                <strong className="text-[#172033] dark:text-[#F1F5F9]">+91 {issuedNotification.mobile}</strong> ({issuedNotification.ownerName}).
              </p>
            </div>
          </div>
          <button
            onClick={() => setIssuedNotification(null)}
            className="btn-success text-xs py-1.5 px-3 self-start sm:self-auto"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Upload & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload Controls & Presets (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="gov-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9] flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#174EA6] dark:text-[#3B82F6]" />
              1. Upload Photo or Video Footage
            </h3>

            {/* Dropzone */}
            <label className="border-2 border-dashed border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#174EA6] dark:hover:border-[#3B82F6] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-[#F7F9FC] dark:bg-[#162238]/60 hover:bg-[#F1F5F9] dark:hover:bg-[#162238] transition group text-center">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA] flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-[#172033] dark:text-[#F1F5F9]">
                Click to browse or drop traffic file
              </span>
              <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                Supports JPG, PNG, MP4, AVI (Up to 100MB)
              </span>
            </label>

            {/* Sample Presets */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] block">
                Or select pre-recorded junction evidence:
              </span>
              <div className="grid grid-cols-1 gap-2">
                {samplePresets.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                      previewUrl === preset.url
                        ? 'border-[#174EA6] dark:border-[#3B82F6] bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#174EA6] dark:text-[#60A5FA]'
                        : 'border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#162238] text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]'
                    }`}
                  >
                    <div>
                      <span className="font-semibold block text-[#172033] dark:text-[#F1F5F9]">{preset.title}</span>
                      <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{preset.location}</span>
                    </div>
                    <Badge status="pending" />
                  </button>
                ))}
              </div>
            </div>

            {/* Location Input */}
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-[#F1F5F9] mb-1">
                Intersection / Camera Location
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="gov-input text-xs"
              />
            </div>

            {/* Scan Button */}
            <button
              type="button"
              onClick={handleRunAiAnalysis}
              disabled={analyzing}
              className="w-full btn-primary py-3 text-xs flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Analyzing Video Frame...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" /> 2. Run AI Violation & ANPR Detection
                </>
              )}
            </button>

            {analyzing && (
              <div className="p-3 bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 rounded-xl border border-[#BFDBFE] dark:border-[#1E3A8A] text-[11px] font-mono text-[#174EA6] dark:text-[#60A5FA] animate-pulse">
                {analysisStep}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Visualizer & Issuance Action (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="gov-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#16856B] dark:text-[#34D399]" />
                AI Visual Telemetry & License Plate Recognition
              </h3>
              {result && (
                <span className="gov-badge-success">
                  Detection Confirmed
                </span>
              )}
            </div>

            {/* Visual Box Frame */}
            <div className="relative rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#1E293B] bg-slate-950 aspect-video flex items-center justify-center group select-none">
              {previewUrl && (
                selectedFile?.type.startsWith('video') || previewUrl.match(/\.(mp4|webm|avi|mov)$/i) ? (
                  <video
                    src={previewUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Traffic camera frame"
                    className="w-full h-full object-cover"
                  />
                )
              )}

              {/* Real-time Bounding Boxes Overlay */}
              {result &&
                result.boxes.map((ann, idx) => {
                  const [ymin, xmin, ymax, xmax] = ann.box;
                  return (
                    <div
                      key={idx}
                      style={{
                        top: `${ymin}%`,
                        left: `${xmin}%`,
                        width: `${xmax - xmin}%`,
                        height: `${ymax - ymin}%`,
                        borderColor: ann.color || '#ef4444',
                      }}
                      className="absolute border-2 border-dashed rounded transition-all animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                    >
                      <span
                        style={{ backgroundColor: ann.color || '#ef4444' }}
                        className="absolute -top-6 left-0 text-[10px] font-mono font-bold text-white px-2 py-0.5 rounded shadow whitespace-nowrap"
                      >
                        {ann.label}
                      </span>
                    </div>
                  );
                })}

              <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/80 border border-white/10 text-[10px] font-mono text-slate-300 backdrop-blur-sm">
                CAM_ID: {locationName.slice(0, 15).toUpperCase()}
              </div>
            </div>

            {/* AI Results Card */}
            {result ? (
              <div className="space-y-4 bg-[#F7F9FC] dark:bg-[#162238]/60 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left Result Info */}
                  <div className="space-y-2 text-xs">
                    <span className="text-[#64748B] dark:text-[#94A3B8] font-medium block">Detected Violation:</span>
                    <span className="text-sm font-bold text-[#DC2626] dark:text-[#F87171] block">{result.message}</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[#64748B] dark:text-[#94A3B8]">ANPR OCR:</span>
                      <span className="font-mono font-bold text-[#172033] dark:text-[#F1F5F9] bg-white dark:bg-[#0D1524] px-2 py-0.5 rounded border border-[#E2E8F0] dark:border-[#1E293B]">
                        {result.plateNumber}
                      </span>
                      <span className="text-[11px] font-mono text-[#16856B] dark:text-[#34D399]">
                        ({(result.plateConfidence * 100).toFixed(1)}% match)
                      </span>
                    </div>
                  </div>

                  {/* Right RTO Match Info */}
                  <div className="space-y-1.5 text-xs bg-white dark:bg-[#111C2E] p-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B]">
                    <span className="text-[#64748B] dark:text-[#94A3B8] font-semibold block flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#174EA6] dark:text-[#3B82F6]" /> RTO Registered Owner:
                    </span>
                    <div className="flex justify-between">
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Name:</span>
                      <span className="font-semibold text-[#172033] dark:text-[#F1F5F9]">{result.matchedVehicle?.ownerName || 'Rajesh Sharma'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Mobile:</span>
                      <span className="font-mono text-[#172033] dark:text-[#F1F5F9]">+91 {result.matchedVehicle?.ownerMobile || '9822012345'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Model:</span>
                      <span className="text-[#172033] dark:text-[#F1F5F9]">{result.matchedVehicle?.model || 'Motor Vehicle'}</span>
                    </div>
                  </div>
                </div>

                {/* Final Issuance CTA */}
                <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-[#64748B] dark:text-[#94A3B8] block">Calculated Penalty:</span>
                    <span className="text-base font-bold text-[#D97706] dark:text-[#FBBF24]">
                      ₹{samplePresets.find((p) => p.plate === result.plateNumber)?.fine || 500}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIssueChallan}
                    disabled={issuing}
                    className="btn-success text-xs py-2 px-4 flex items-center gap-2"
                  >
                    {issuing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching SMS Notice...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Issue E-Challan & Notify Owner
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#F7F9FC] dark:bg-[#162238]/60 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                Click <strong>"Run AI Violation & ANPR Detection"</strong> to analyze footage and recognize the license plate.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
