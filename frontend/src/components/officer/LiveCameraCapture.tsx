import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RotateCw,
  X,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Zap,
  Activity,
  Square,
} from 'lucide-react';
import { api } from '../../services/api';

interface LiveCameraCaptureProps {
  onCapture?: (file: File, previewUrl: string) => void;
  onLiveDetectionResult?: (result: any, previewUrl: string, file: File) => void;
  onClose: () => void;
  locationName?: string;
  manualPlate?: string;
}

export const LiveCameraCapture: React.FC<LiveCameraCaptureProps> = ({
  onCapture,
  onLiveDetectionResult,
  onClose,
  locationName = 'Field Patrol Post',
  manualPlate,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlashing, setShutterFlashing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null);

  // Automatic Live AI Detection state
  const [isAutoDetecting, setIsAutoDetecting] = useState(true);
  const [analyzingFrame, setAnalyzingFrame] = useState(false);
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [liveAlert, setLiveAlert] = useState<string | null>(null);

  const isDetectingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Play realistic shutter click / alert via Web Audio API
  const playAlertSound = useCallback(
    (isViolation: boolean = false) => {
      if (!soundEnabled) return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (isViolation) {
          // Double beep for violation alert
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        } else {
          // Subtle snapshot click
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        }
      } catch {
        // Audio blocked or unsupported
      }
    },
    [soundEnabled]
  );

  // Enumerate video devices
  const enumerateDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setCameras(videoDevices);
    } catch (e) {
      console.warn('Failed to enumerate media devices:', e);
    }
  }, []);

  // Stop current active media stream and clean up resources
  const stopCurrentStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  // Start live camera stream
  const startCamera = useCallback(
    async (deviceId?: string, facing: 'environment' | 'user' = facingMode) => {
      setIsInitializing(true);
      setCameraError(null);

      stopCurrentStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Live camera capture is not supported by your browser or connection. Please use HTTPS or localhost, or upload a photo from gallery.'
        );
        setIsInitializing(false);
        return;
      }

      const constraintsList: MediaStreamConstraints[] = [
        {
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                facingMode: facing,
                width: { ideal: 1920, min: 640 },
                height: { ideal: 1080, min: 480 },
              },
          audio: false,
        },
        {
          video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: facing },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      let newStream: MediaStream | null = null;
      let lastErr: unknown = null;

      for (const constraints of constraintsList) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err: unknown) {
          lastErr = err;
        }
      }

      if (!newStream) {
        const error = lastErr as { name?: string; message?: string } | null;
        if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
          setCameraError(
            'Camera permission was denied. Please allow camera permissions in your browser address bar and reload.'
          );
        } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
          setCameraError('No camera hardware was detected on this device.');
        } else {
          setCameraError(
            `Unable to access live camera: ${error?.message || 'Device in use or unsupported'}. You can still upload images from gallery.`
          );
        }
        setIsInitializing(false);
        return;
      }

      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            setVideoResolution({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            });
            videoRef.current.play().catch((playErr) => console.warn('Video play interrupted:', playErr));
          }
          setIsInitializing(false);
        };
      } else {
        setIsInitializing(false);
      }

      await enumerateDevices();
    },
    [facingMode, stopCurrentStream, enumerateDevices]
  );

  // Initialize camera on mount
  useEffect(() => {
    isMountedRef.current = true;
    startCamera();
    return () => {
      isMountedRef.current = false;
      stopCurrentStream();
    };
  }, []);

  // Continuous frame analysis without requiring button clicks
  const processLiveFrame = useCallback(async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      isDetectingRef.current ||
      !isMountedRef.current ||
      !isAutoDetecting
    ) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.paused || video.ended) {
      return;
    }

    isDetectingRef.current = true;
    setAnalyzingFrame(true);

    try {
      const canvas = canvasRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        isDetectingRef.current = false;
        setAnalyzingFrame(false);
        return;
      }

      ctx.drawImage(video, 0, 0, width, height);

      // Convert canvas to JPEG blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
      });

      if (!blob || !isMountedRef.current) {
        isDetectingRef.current = false;
        setAnalyzingFrame(false);
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `live_frame_${timestamp}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);

      const formData = new FormData();
      formData.append('file', file);
      if (locationName) formData.append('location', locationName);
      if (manualPlate && manualPlate.trim()) {
        formData.append('vehicle_plate', manualPlate.trim().toUpperCase());
      }

      const res = await api.captureAndDetectViolation(formData);

      if (isMountedRef.current) {
        setFramesAnalyzed((prev) => prev + 1);

        if (res.status === 'VIOLATION_DETECTED') {
          playAlertSound(true);
          const chCount = res.total_challans_created || res.vehicles?.length || 1;
          const firstPlate = res.vehicles?.[0]?.vehicle_number || res.vehicle_number || 'Vehicle';
          const firstViol =
            res.vehicles?.[0]?.violations?.[0]?.violation_name || 'Traffic Violation';
          setLiveAlert(`⚠️ VIOLATION DETECTED: ${firstPlate} (${firstViol}) • ${chCount} Challan(s) Created`);
        } else if (res.status === 'DUPLICATE_PREVENTED') {
          setLiveAlert(`ℹ️ Active Challan: ${res.vehicle_number || 'Vehicle'} (${res.violation || 'Violation'})`);
        } else if (res.status === 'NO_VIOLATION') {
          const vehCount = res.total_vehicles_detected || (res.clean_vehicles?.length || 1);
          const plates = res.clean_vehicles
            ?.map((cv: any) => cv.plate_number)
            .filter((p: string) => p && p !== 'Clean / Compliant')
            .join(', ');
          setLiveAlert(`✓ ${vehCount} Vehicle(s) Analyzed — Compliant${plates ? ` [${plates}]` : ''}`);
        } else if (res.status === 'PLATE_NOT_FOUND') {
          setLiveAlert(`⚠️ Plate Unreadable: Violation detected, officer review required`);
        }

        if (onLiveDetectionResult) {
          onLiveDetectionResult(res, previewUrl, file);
        }
      }
    } catch (err) {
      console.warn('[LiveCamera] Detection frame error:', err);
    } finally {
      if (isMountedRef.current) {
        isDetectingRef.current = false;
        setAnalyzingFrame(false);
      }
    }
  }, [isAutoDetecting, locationName, manualPlate, onLiveDetectionResult, playAlertSound]);

  // Frame sampling timer: runs continuously while camera stream is active
  useEffect(() => {
    if (!isAutoDetecting || isInitializing || !!cameraError) return;

    const interval = setInterval(() => {
      if (!isDetectingRef.current && isMountedRef.current) {
        processLiveFrame();
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [isAutoDetecting, isInitializing, cameraError, processLiveFrame]);

  // Switch facing mode (Front / Back)
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(undefined, nextMode);
  };

  // Switch specific camera device
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    startCamera(newId);
  };

  // Optional manual shutter snapshot
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setShutterFlashing(true);
    playAlertSound(false);
    setTimeout(() => setShutterFlashing(false), 200);

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `manual_snapshot_${timestamp}.jpg`;
        const file = new File([blob], filename, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        if (onCapture) {
          onCapture(file, previewUrl);
        }
      },
      'image/jpeg',
      0.95
    );
  };

  // Stop camera and cleanly exit
  const handleStopCamera = () => {
    setIsAutoDetecting(false);
    stopCurrentStream();
    onClose();
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-xl flex flex-col">
      {/* Hidden canvas used for grabbing snapshot */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top HUD Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/85 via-black/50 to-transparent text-white text-xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/90 text-white font-bold text-[10px] tracking-wider uppercase animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            Live Camera AI Active
          </span>
          {videoResolution && (
            <span className="px-2 py-0.5 rounded bg-black/50 border border-white/10 text-[10px] text-slate-300 font-mono">
              {videoResolution.width}×{videoResolution.height}
            </span>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/50 border border-white/10 text-[10px] text-emerald-400 font-mono">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            Continuous Auto-Detect
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute/Sound toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Mute shutter sound' : 'Unmute shutter sound'}
            className="p-1.5 rounded-lg bg-black/50 hover:bg-black/80 border border-white/10 text-white/80 transition"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {/* Switch Camera if multiple available */}
          {cameras.length > 1 ? (
            <select
              value={selectedCameraId}
              onChange={handleCameraChange}
              className="bg-black/60 border border-white/20 text-white text-[11px] rounded px-2 py-1 focus:outline-none"
            >
              {cameras.map((c, i) => (
                <option key={c.deviceId || i} value={c.deviceId} className="bg-slate-900 text-white">
                  {c.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={toggleFacingMode}
              title="Flip Camera (Front/Rear)"
              className="p-1.5 rounded-lg bg-black/50 hover:bg-black/80 border border-white/10 text-white/80 transition flex items-center gap-1 text-[11px]"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px]">Flip</span>
            </button>
          )}

          {/* Stop / Close camera button */}
          <button
            type="button"
            onClick={handleStopCamera}
            className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition ml-1 flex items-center gap-1 text-[11px] font-bold"
            title="Stop Live Camera"
          >
            <Square className="w-3 h-3 fill-white" />
            <span>Stop Cam</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Live Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isInitializing ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {/* Shutter Flash Animation */}
        {shutterFlashing && (
          <div className="absolute inset-0 bg-white pointer-events-none z-30 transition-opacity duration-150 animate-pulse" />
        )}

        {/* Loading Spinner */}
        {isInitializing && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-10 gap-3">
            <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-300 font-medium">Starting Live Camera & Automatic AI Detection...</p>
          </div>
        )}

        {/* Camera Error Screen */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-center z-20 text-white">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-red-200 mb-1">Live Camera Unavailable</h4>
            <p className="text-xs text-slate-300 max-w-sm mb-4 leading-relaxed">{cameraError}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={handleStopCamera}
                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition"
              >
                Use Photo Upload
              </button>
            </div>
          </div>
        )}

        {/* Target Reticle & HUD Overlay when Camera is Active */}
        {!isInitializing && !cameraError && (
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 sm:p-6">
            {/* Corner Brackets */}
            <div className="w-full flex justify-between">
              <div className="w-8 h-8 border-t-2 border-l-2 border-amber-400/80 rounded-tl-sm" />
              <div className="w-8 h-8 border-t-2 border-r-2 border-amber-400/80 rounded-tr-sm" />
            </div>

            {/* Live Detection Status Alert Banner */}
            <div className="self-center flex flex-col items-center gap-2 max-w-md w-full px-2">
              {liveAlert && (
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-md text-center transition-all ${
                    liveAlert.startsWith('⚠️')
                      ? 'bg-red-600/90 text-white border border-red-400 animate-bounce'
                      : liveAlert.startsWith('✓')
                      ? 'bg-emerald-600/90 text-white border border-emerald-400'
                      : 'bg-black/80 text-amber-300 border border-amber-400/50'
                  }`}
                >
                  {liveAlert}
                </div>
              )}

              {/* Center Vehicle / License Plate Target Box */}
              <div className="w-64 sm:w-80 h-28 sm:h-32 border-2 border-dashed border-emerald-400/70 rounded-lg bg-emerald-500/5 relative flex items-center justify-center">
                {/* Crosshairs */}
                <div className="absolute w-4 h-0.5 bg-emerald-400" />
                <div className="absolute w-0.5 h-4 bg-emerald-400" />
                <span className="text-[10px] text-emerald-300 font-mono tracking-wider uppercase bg-black/60 px-2 py-0.5 rounded border border-emerald-400/30">
                  {analyzingFrame ? '⚡ AI Analyzing Frame...' : 'Automatic Live Multi-Vehicle Detection'}
                </span>
              </div>
            </div>

            {/* Bottom Corner Brackets & Field Location Watermark */}
            <div className="w-full flex items-end justify-between">
              <div className="w-8 h-8 border-b-2 border-l-2 border-amber-400/80 rounded-bl-sm" />
              <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 border border-white/10 flex items-center gap-2">
                <span>PATROL: {locationName}</span>
                <span>•</span>
                <span className="text-amber-300 font-bold">Frames Analyzed: {framesAnalyzed}</span>
              </div>
              <div className="w-8 h-8 border-b-2 border-r-2 border-amber-400/80 rounded-br-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
        {/* Continuous Detection Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                analyzingFrame ? 'bg-amber-400 opacity-75' : 'bg-emerald-400 opacity-75'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                analyzingFrame ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <div className="text-left hidden sm:block">
            <span className="font-bold text-slate-200 block text-[11px]">
              {analyzingFrame ? 'AI Processing Live Frame...' : 'Continuous Automatic Detection'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Auto-detecting vehicles, plates & violations without button clicks
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Optional manual snapshot */}
          <button
            type="button"
            disabled={isInitializing || !!cameraError}
            onClick={capturePhoto}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
            title="Click an optional high-resolution snapshot"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Snap Still</span>
          </button>

          {/* Prominent Stop Camera Button */}
          <button
            type="button"
            onClick={handleStopCamera}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold rounded-lg text-xs shadow-md transition"
          >
            <Square className="w-3 h-3 fill-white" />
            <span>Stop Camera</span>
          </button>
        </div>
      </div>
    </div>
  );
};
