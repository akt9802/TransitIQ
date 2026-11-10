"use client";

import { useEffect, useRef, useState } from "react";
import { primaryBtn, quietBtn } from "@/components/dashboard/styles";

export async function openCameraStream(): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new Error("The camera needs a secure page. Use https, or install the app.");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser has no camera.");
  }
  const attempts: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    { audio: false, video: true },
  ];
  let last: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      last = error;
      if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
        throw new Error("Allow the camera for this site, then try again.");
      }
    }
  }
  if (last instanceof DOMException && last.name === "NotFoundError") {
    throw new Error("No camera was found. Choose a saved photo instead.");
  }
  if (last instanceof DOMException && last.name === "NotReadableError") {
    throw new Error("The camera is already open in another app. Close it, then try again.");
  }
  throw new Error("The camera did not open. Choose a saved photo instead.");
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function CameraFrame({
  busy = false,
  onShot,
  onClose,
}: {
  busy?: boolean;
  onShot: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let opened: MediaStream | null = null;
    openCameraStream()
      .then((next) => {
        if (cancelled) {
          stopTracks(next);
          return;
        }
        opened = next;
        setStream(next);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The camera did not open.");
      });
    return () => {
      cancelled = true;
      stopTracks(opened);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [stream]);

  async function shoot() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setError("The camera is not ready yet.");
      return;
    }
    const longest = Math.max(video.videoWidth, video.videoHeight);
    const scale = Math.min(1, 1600 / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Photo is not valid");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob) {
      setError("Photo is not valid");
      return;
    }
    onShot(new File([blob], "photo.jpg", { type: "image/jpeg" }));
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm font-extrabold text-ink">{error}</p> : null}
      <video
        ref={videoRef}
        className="aspect-[3/4] w-full max-w-md border-2 border-ink bg-ink object-cover"
        playsInline
        muted
        autoPlay
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryBtn} disabled={busy || !stream} onClick={() => void shoot()}>
          {busy ? "Saving" : "Take photo"}
        </button>
        <button type="button" className={quietBtn} disabled={busy} onClick={onClose}>
          Close
        </button>
        <button type="button" className={quietBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
          Choose a saved photo
        </button>
      </div>
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onShot(file);
        }}
      />
    </div>
  );
}
