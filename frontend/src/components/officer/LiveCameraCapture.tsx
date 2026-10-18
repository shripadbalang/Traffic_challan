import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RotateCw,
  X,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Maximize,
  FlipHorizontal,
  Zap,
} from 'lucide-react';

interface LiveCameraCaptureProps {
  onCapture: (file: File, previewUrl: string) => void;
  onClose: () => void;
  locationName?: string;
}

export const LiveCameraCapture: React.FC<LiveCameraCaptureProps> = ({
  onCapture,
  onClose,
  locationName = 'Field Patrol Post',
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

  // Play realistic shutter click via Web Audio API (no external asset needed)
  const playShutterSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio playback blocked or not supported
    }
  }, [soundEnabled]);

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

  // Stop current active media stream
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

      // Stop any existing tracks before requesting a new stream
      stopCurrentStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Live camera capture is not supported by your browser or connection. Please use HTTPS or localhost, or upload a photo from gallery.'
        );
        setIsInitializing(false);
        return;
      }

      // Constraints: try optimal 1080p/720p, falling back gracefully
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
    startCamera();
    return () => {
      // Clean up tracks when component unmounts
      stopCurrentStream();
    };
  }, []);

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

  // Shutter action: Click live photo
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

    // Trigger visual shutter flash and sound
    setShutterFlashing(true);
    playShutterSound();
    setTimeout(() => setShutterFlashing(false), 200);

    // Draw the exact frame
    ctx.drawImage(video, 0, 0, width, height);

    // Convert canvas frame to JPEG blob
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `live_violation_${timestamp}.jpg`;
        const file = new File([blob], filename, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        // Turn off stream now that snapshot is captured
        stopCurrentStream();

        // Forward to officer dashboard
        onCapture(file, previewUrl);
      },
      'image/jpeg',
      0.95
    );
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-xl flex flex-col">
      {/* Hidden canvas used for grabbing snapshot */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top HUD Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white text-xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/90 text-white font-bold text-[10px] tracking-wider uppercase animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            Live Patrol Cam
          </span>
          {videoResolution && (
            <span className="px-2 py-0.5 rounded bg-black/50 border border-white/10 text-[10px] text-slate-300 font-mono">
              {videoResolution.width}×{videoResolution.height}
            </span>
          )}
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

          {/* Close camera button */}
          <button
            type="button"
            onClick={() => {
              stopCurrentStream();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition ml-1"
            title="Close Live Camera"
          >
            <X className="w-4 h-4" />
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
            <p className="text-xs text-slate-300 font-medium">Accessing Field Patrol Camera...</p>
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
                onClick={onClose}
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

            {/* Center Vehicle / License Plate Target Box */}
            <div className="self-center flex flex-col items-center">
              <div className="w-64 sm:w-80 h-28 sm:h-32 border-2 border-dashed border-emerald-400/70 rounded-lg bg-emerald-500/5 relative flex items-center justify-center">
                {/* Crosshairs */}
                <div className="absolute w-4 h-0.5 bg-emerald-400" />
                <div className="absolute w-0.5 h-4 bg-emerald-400" />
                <span className="text-[10px] text-emerald-300 font-mono tracking-wider uppercase bg-black/60 px-2 py-0.5 rounded border border-emerald-400/30">
                  Align Vehicle / Plate Inside Box
                </span>
              </div>
            </div>

            {/* Bottom Corner Brackets & Field Location Watermark */}
            <div className="w-full flex items-end justify-between">
              <div className="w-8 h-8 border-b-2 border-l-2 border-amber-400/80 rounded-bl-sm" />
              <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 border border-white/10">
                PATROL: {locationName} • {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="w-8 h-8 border-b-2 border-r-2 border-amber-400/80 rounded-br-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Shutter Controls Bar */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4">
        <div className="text-slate-400 text-xs hidden sm:block">
          <span className="font-semibold text-slate-200">Point at Violating Vehicle</span>
          <p className="text-[11px] text-slate-500">Hold steady for crisp OCR and AI helmet detection</p>
        </div>

        {/* Shutter Capture Button */}
        <div className="flex-1 sm:flex-none flex items-center justify-center">
          <button
            type="button"
            disabled={isInitializing || !!cameraError}
            onClick={capturePhoto}
            className="group relative flex items-center justify-center gap-2.5 px-6 py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-red-600 group-hover:scale-125 transition-transform" />
            </div>
            <span className="text-sm tracking-wide uppercase font-extrabold">Click Violation Photo</span>
          </button>
        </div>

        {/* Cancel button */}
        <button
          type="button"
          onClick={() => {
            stopCurrentStream();
            onClose();
          }}
          className="text-xs text-slate-400 hover:text-white transition px-3 py-2 rounded-lg hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
