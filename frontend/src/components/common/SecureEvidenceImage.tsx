import React, { useState, useEffect } from 'react';
import { Camera, ImageOff, Maximize2, ExternalLink, RefreshCw, X } from 'lucide-react';
import { fetchEvidenceBlobUrl } from '../../services/api';

interface SecureEvidenceImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  containerClassName?: string;
  allowZoom?: boolean;
  fallbackText?: string;
  onLoadSuccess?: () => void;
}

export const SecureEvidenceImage: React.FC<SecureEvidenceImageProps> = ({
  src,
  alt = 'Violation Evidence',
  className = 'w-full h-auto object-contain max-h-[420px] rounded-lg',
  containerClassName = 'relative w-full rounded-xl overflow-hidden bg-[#0F172A] flex items-center justify-center min-h-[200px]',
  allowZoom = true,
  fallbackText = 'Violation evidence image is currently unavailable.',
  onLoadSuccess,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl: string | null = null;

    if (!src) {
      setBlobUrl(null);
      setError('No evidence reference provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchEvidenceBlobUrl(src)
      .then((url) => {
        if (!isMounted) {
          URL.revokeObjectURL(url);
          return;
        }
        currentBlobUrl = url;
        setBlobUrl(url);
        setLoading(false);
        if (onLoadSuccess) onLoadSuccess();
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[SecureEvidenceImage] Failed to load evidence:', err?.message || err);
        setError(err?.message || 'Evidence unavailable');
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [src]);

  return (
    <>
      <div className={containerClassName}>
        {loading && (
          <div className="py-12 px-4 text-center text-slate-400 flex flex-col items-center gap-2 select-none">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs font-semibold tracking-wide">
              Loading official evidence image...
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
              <ImageOff className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-300 text-sm">{fallbackText}</p>
            <span className="text-[11px] text-slate-500 max-w-xs">
              Citation photographic capture record could not be loaded from enforcement archive.
            </span>
          </div>
        )}

        {!loading && !error && blobUrl && (
          <div className="relative group w-full flex items-center justify-center">
            <img
              src={blobUrl}
              alt={alt}
              className={className}
              onError={() => setError('Image rendering failed.')}
            />

            {allowZoom && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs font-semibold backdrop-blur-sm border border-white/20 shadow-md flex items-center gap-1 transition"
                  title="Inspect Original High-Resolution Evidence"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Full Resolution</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* High-Resolution Fullscreen Lightbox Modal */}
      {isZoomOpen && blobUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-6xl flex items-center justify-between py-2 px-4 text-white text-xs">
            <div className="flex items-center gap-2 font-mono">
              <Camera className="w-4 h-4 text-amber-400" />
              <span className="font-bold tracking-wide">{alt}</span>
              <span className="text-emerald-400 font-semibold">• 100% Original Resolution</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.open(blobUrl, '_blank')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center gap-1.5 border border-slate-700 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Tab</span>
              </button>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/80 text-white border border-slate-700 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 w-full max-w-6xl overflow-auto flex items-center justify-center p-2">
            <img
              src={blobUrl}
              alt={alt}
              className="max-h-[85vh] max-w-full object-contain rounded-lg border border-slate-800 shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
};
