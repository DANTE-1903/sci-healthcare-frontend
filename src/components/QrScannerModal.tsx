'use client';

import { BrowserQRCodeReader } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useLocaleContext } from '@/i18n/LocaleContext';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (voucherId: string) => void;
}

/**
 * Parses raw scanned data into a valid voucher ID.
 * Supports:
 * - Direct voucher ID (e.g. "42", "#42")
 * - URL path (e.g. "https://example.com/vouchers/42", "/vouchers/42?contract=...")
 * - JSON payload (e.g. {"id":"42", ...})
 */
export function extractVoucherId(scanned: string): string | null {
  const trimmed = scanned.trim();
  if (!trimmed) return null;

  // Case 1: JSON payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && (parsed.id || parsed.voucherId)) {
        return String(parsed.id || parsed.voucherId).replace(/^#/, '');
      }
    } catch {
      // not JSON
    }
  }

  // Case 2: URL containing /vouchers/:id
  const urlMatch = trimmed.match(/\/vouchers\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Case 3: Simple numeric or alphanumeric ID e.g. "123", "#123"
  const cleanId = trimmed.replace(/^#/, '');
  if (/^[a-zA-Z0-9_-]+$/.test(cleanId)) {
    return cleanId;
  }

  return null;
}

/**
 * Camera QR scanner modal: the native BarcodeDetector where available, with a
 * ZXing fallback (#4).
 * Works offline once loaded.
 */
export function QrScannerModal({ open, onClose, onScan }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');

  // Start camera stream when modal opens
  useEffect(() => {
    if (!open) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    let active = true;

    function handleDetected(rawValue: string) {
      const id = extractVoucherId(rawValue);
      if (id) {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        onScan(id);
      }
    }

    function startScanning() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BarcodeDetectorClass = typeof window !== 'undefined' ? (window as any).BarcodeDetector : null;
      let detector: { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } | null = null;

      if (BarcodeDetectorClass) {
        try {
          detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }

      const zxing = new BrowserQRCodeReader();
      const scanFrame = async () => {
        if (!active) return;
        const video = videoRef.current;
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
          animationFrameRef.current = requestAnimationFrame(scanFrame);
          return;
        }

        // Try native BarcodeDetector first
        if (detector) {
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              handleDetected(barcodes[0].rawValue);
              return;
            }
          } catch {
            // Fall through to the ZXing fallback
          }
        }

        // Fallback: draw the frame to a canvas and decode it with ZXing, the
        // QR library the app already uses for patient backups.
        const canvas = canvasRef.current;
        if (canvas) {
          const width = video.videoWidth;
          const height = video.videoHeight;
          if (width > 0 && height > 0) {
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, width, height);
              try {
                const text = zxing.decodeFromCanvas(canvas).getText();
                if (text) {
                  handleDetected(text);
                  return;
                }
              } catch {
                // No QR code in this frame; keep scanning.
              }
            }
          }
        }

        animationFrameRef.current = requestAnimationFrame(scanFrame);
      };

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }

    async function startCamera() {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false);
        setCameraError('Camera access is not supported by your browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setHasCamera(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          startScanning();
        }
      } catch (err) {
        if (!active) return;
        setHasCamera(false);
        const msg =
          err instanceof Error
            ? err.name === 'NotAllowedError'
              ? 'Camera permission was denied. You can enter the voucher ID manually below.'
              : err.message
            : 'Unable to access camera.';
        setCameraError(msg);
      }
    }

    void startCamera();

    const videoEl = videoRef.current;
    return () => {
      active = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [open, onScan]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = extractVoucherId(manualInput);
    if (id) {
      onScan(id);
    }
  }

  const { t } = useLocaleContext();

  return (
    <Modal open={open} onClose={onClose} title={t('scanner.title')}>
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-ink-soft)]">
          {t('scanner.instructions')}
        </p>

        {/* Video Scanner Area */}
        <div className="relative aspect-square w-full max-w-xs mx-auto overflow-hidden rounded-xl border-2 border-dashed border-[var(--color-line)] bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            className={`h-full w-full object-cover ${hasCamera ? '' : 'hidden'}`}
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Target Scanning Overlay */}
          {hasCamera && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-44 rounded-lg border-2 border-[var(--color-brand)] bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
            </div>
          )}

          {hasCamera === false && (
            <div className="p-4 text-center text-xs text-white space-y-2">
              <p>{cameraError || t('scanner.cameraUnavailable')}</p>
            </div>
          )}

          {hasCamera === null && (
            <div className="text-xs text-white/70 animate-pulse">
              {t('scanner.requestingCamera')}
            </div>
          )}
        </div>

        {/* Manual Fallback Input */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-[var(--color-line)] space-y-2">
          <label htmlFor="manual-voucher-id" className="block text-xs font-medium text-[var(--color-ink-soft)]">
            {t('scanner.manualPrompt')}
          </label>
          <div className="flex gap-2">
            <input
              id="manual-voucher-id"
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={t('scanner.manualPlaceholder')}
              className="flex-1 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm mono text-[var(--color-ink)]"
            />
            <Button
              type="submit"
              disabled={!manualInput.trim()}
              className="text-xs px-3"
            >
              {t('scanner.open')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
