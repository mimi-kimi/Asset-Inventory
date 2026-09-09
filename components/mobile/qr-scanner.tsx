"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, X } from "lucide-react";

export function QrScannerOverlay({
  onDecoded,
  onClose,
}: {
  onDecoded: (text: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader", false);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (!cancelled) onDecoded(decodedText);
          },
          () => {
            /* per-frame miss — ignore */
          },
        );
      } catch {
        if (!cancelled) {
          setError(
            "Could not start the camera. Check permissions, or enter the ID manually.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onDecoded]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-bold">Scan the QR plate</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2"
          aria-label="Close scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <div
          id="qr-reader"
          className="w-full max-w-sm overflow-hidden rounded-2xl"
          style={{ minHeight: 260 }}
        />
        {error ? (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm">{error}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Point the camera at the
            plate&apos;s QR code.
          </p>
        )}
      </div>
      <p className="pb-8 text-center text-xs text-zinc-400">
        The plate&apos;s QR contains the ID-Inventory as plain text.
      </p>
    </div>
  );
}
