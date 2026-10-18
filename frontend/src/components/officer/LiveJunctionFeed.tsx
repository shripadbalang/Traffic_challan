import React, { useState, useEffect } from 'react';
import {
  Radio,
  Camera,
  Layers,
  AlertCircle,
  Eye,
  Maximize2,
  RefreshCw,
  Send,
  CheckCircle2,
  Car,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { api } from '../../services/api';
import { Challan } from '../../types';

interface Junction {
  id: string;
  name: string;
  city: string;
  cameraCount: number;
  feedUrl: string;
  activeViolations: number;
  samplePlate: string;
  sampleViolation: string;
  sampleFine: number;
}

export interface LiveJunctionFeedProps {
  onChallanIssued?: (challan: Challan) => void;
}

export const LiveJunctionFeed: React.FC<LiveJunctionFeedProps> = ({
  onChallanIssued,
}) => {
  const junctions: Junction[] = [
    {
      id: 'CAM-PUN-01',
      name: 'FC Road Junction (Near Goodluck)',
      city: 'Pune',
      cameraCount: 4,
      feedUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80',
      activeViolations: 3,
      samplePlate: 'MH12DE1433',
      sampleViolation: 'Riding without helmet',
      sampleFine: 500,
    },
    {
      id: 'CAM-MUM-02',
      name: 'Bandra-Kurla Complex Flyover',
      city: 'Mumbai',
      cameraCount: 6,
      feedUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80',
      activeViolations: 2,
      samplePlate: 'MH14EU8921',
      sampleViolation: 'Wrong-side driving',
      sampleFine: 1500,
    },
    {
      id: 'CAM-PUN-03',
      name: 'Shivaji Nagar Chowk',
      city: 'Pune',
      cameraCount: 3,
      feedUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
      activeViolations: 5,
      samplePlate: 'MH12DE1433',
      sampleViolation: 'Using mobile phone while driving',
      sampleFine: 1000,
    },
    {
      id: 'CAM-MUM-04',
      name: 'Marine Drive Northbound Express',
      city: 'Mumbai',
      cameraCount: 8,
      feedUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1200&q=80',
      activeViolations: 1,
      samplePlate: 'MH02CD4590',
      sampleViolation: 'Triple riding on two-wheeler',
      sampleFine: 1000,
    },
  ];

  const [activeJunction, setActiveJunction] = useState<Junction>(junctions[0]);
  const [capturing, setCapturing] = useState(false);
  const [capturedEvent, setCapturedEvent] = useState<any | null>(null);
  const [feedTimestamp, setFeedTimestamp] = useState<string>(new Date().toLocaleTimeString('en-IN'));

  useEffect(() => {
    const timer = setInterval(() => {
      setFeedTimestamp(new Date().toLocaleTimeString('en-IN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCaptureFrame = async () => {
    setCapturing(true);
    await new Promise((r) => setTimeout(r, 800));

    setCapturedEvent({
      junctionName: activeJunction.name,
      plate: activeJunction.samplePlate,
      violation: activeJunction.sampleViolation,
      fine: activeJunction.sampleFine,
      timestamp: new Date().toLocaleTimeString('en-IN'),
      confidence: '96.8%',
      feedUrl: activeJunction.feedUrl,
    });
    setCapturing(false);
  };

  const handleQuickIssue = async () => {
    if (!capturedEvent) return;
    try {
      const res = await api.issueChallan({
        plateNumber: capturedEvent.plate,
        violationCode: 'AI_LIVE_FEED',
        violationName: capturedEvent.violation,
        fineAmount: capturedEvent.fine,
        location: capturedEvent.junctionName,
        evidenceUrl: capturedEvent.feedUrl,
        aiConfidence: 0.96,
        detectionSource: 'ai',
      });
      alert(`Challan ${res.challan.id} registered and notification dispatched to owner!`);
      if (onChallanIssued) onChallanIssued(res.challan);
      setCapturedEvent(null);
    } catch {
      alert('Failed to issue live challan.');
    }
  };

  return (
    <div className="space-y-6">
      {/* CCTV Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
          </span>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Live AI Junction Stream
          </h3>
          <span className="text-xs text-slate-500 font-mono">| {feedTimestamp} IST</span>
        </div>

        {/* Junction Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {junctions.map((j) => (
            <button
              key={j.id}
              onClick={() => {
                setActiveJunction(j);
                setCapturedEvent(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeJunction.id === j.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{j.city}</span> - <span className="opacity-80">{j.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main CCTV Feed Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Camera Monitor (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
          {/* Top Camera Header */}
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="font-bold text-white">{activeJunction.name}</span>
              <span className="text-slate-500">[{activeJunction.id}]</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span>FPS: <strong className="text-emerald-400">29.8</strong></span>
              <span>Latency: <strong className="text-blue-400">14ms</strong></span>
            </div>
          </div>

          {/* Video Stream Container with Radar Scanline */}
          <div className="relative aspect-video bg-slate-950 overflow-hidden select-none">
            <img
              src={activeJunction.feedUrl}
              alt={activeJunction.name}
              className="w-full h-full object-cover"
            />

            {/* Radar Scanline Animation */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-radar-sweep opacity-75 shadow-[0_0_12px_cyan]" />

            {/* Simulated Live Detection Box on Camera Feed */}
            <div className="absolute top-[28%] left-[40%] w-[25%] h-[40%] border-2 border-dashed border-rose-500 rounded animate-pulse">
              <span className="absolute -top-6 left-0 bg-rose-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                Violation Detected: {activeJunction.sampleViolation}
              </span>
            </div>

            {/* Bottom Floating Stats */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <div className="px-2.5 py-1 rounded bg-slate-950/90 border border-slate-800 text-[11px] text-slate-200 backdrop-blur-md">
                Active ANPR: <strong className="text-amber-400">{activeJunction.samplePlate}</strong>
              </div>
            </div>

            <div className="absolute bottom-3 right-3">
              <button
                type="button"
                onClick={handleCaptureFrame}
                disabled={capturing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/40 transition disabled:opacity-50"
              >
                {capturing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Capturing Frame...
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" /> Capture & Extract Violation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Telemetry & Quick Issuance Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Live Frame Extraction & Citation
            </h4>

            {capturedEvent ? (
              <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800 animate-fade-in text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Captured Plate:</span>
                  <Badge variant="plate">{capturedEvent.plate}</Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Violation:</span>
                    <span className="font-semibold text-rose-300">{capturedEvent.violation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fine Amount:</span>
                    <span className="font-bold text-amber-400 text-sm">₹{capturedEvent.fine}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Confidence:</span>
                    <span className="font-mono text-emerald-400">{capturedEvent.confidence}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Location:</span>
                    <span className="text-slate-300 truncate max-w-[150px]">{capturedEvent.junctionName}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleQuickIssue}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Issue Challan to Owner
                </button>
              </div>
            ) : (
              <div className="p-6 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-xs text-slate-500 space-y-2">
                <Camera className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                <p>
                  Press <strong>"Capture & Extract Violation"</strong> on any live stream frame to trigger instant AI bounding box & plate OCR extraction.
                </p>
              </div>
            )}

            {/* Junction Info Card */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
              <span className="text-slate-400 font-semibold block">Junction Deployment:</span>
              <div className="flex justify-between text-slate-300">
                <span>Active 4K PTZ Cameras:</span>
                <span className="font-mono">{activeJunction.cameraCount}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>24h Violations Flagged:</span>
                <span className="font-mono text-amber-400">{activeJunction.activeViolations * 14}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
