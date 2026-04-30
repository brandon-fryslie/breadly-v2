"use client";

// Photo upload field for the post-a-loaf form. Owns the file → signed-URL
// → direct PUT dance and writes the resulting public URL into a hidden
// `photoUrl` form field that the server action picks up.
//
// One source of truth for the field's value: the hidden `photoUrl` input.
// File select, manual URL input, and "remove" all converge on it through a
// single `setPhotoUrl` setter, so the action only ever reads one field.
// [LAW:one-source-of-truth]
//
// The manual URL row stays for two reasons: (1) e2e tests run without GCS
// creds; (2) it's a useful escape hatch when ADC isn't configured locally.
// It will likely go away once breadly-baker-bwo enforces photo-required.

import { useRef, useState } from "react";

const ACCEPT = "image/jpeg,image/png,image/webp";

type SignedPutResponse = {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  contentType: string;
  expiresAt: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "uploading"; progress: number }
  | { kind: "ready"; publicUrl: string }
  | { kind: "error"; message: string };

async function signUpload(contentType: string): Promise<SignedPutResponse> {
  const res = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `sign failed (${res.status})`);
  }
  return (await res.json()) as SignedPutResponse;
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("upload network error"));
    xhr.send(file);
  });
}

export function PhotoField({
  defaultValue,
  error,
  fieldClass,
}: {
  defaultValue: string;
  error?: string;
  fieldClass: (error?: string) => string;
}) {
  const [photoUrl, setPhotoUrl] = useState<string>(defaultValue);
  const [status, setStatus] = useState<Status>(
    defaultValue ? { kind: "ready", publicUrl: defaultValue } : { kind: "idle" },
  );
  const [showManual, setShowManual] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus({ kind: "signing" });
    try {
      const signed = await signUpload(file.type);
      setStatus({ kind: "uploading", progress: 0 });
      await uploadWithProgress(signed.uploadUrl, file, (p) =>
        setStatus({ kind: "uploading", progress: p }),
      );
      setPhotoUrl(signed.publicUrl);
      setStatus({ kind: "ready", publicUrl: signed.publicUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : "upload failed";
      setStatus({ kind: "error", message });
    }
  }

  function clear() {
    setPhotoUrl("");
    setStatus({ kind: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const busy = status.kind === "signing" || status.kind === "uploading";

  return (
    <div className="text-sm space-y-2">
      <span className="block text-stone-700 font-medium">Photo</span>

      {photoUrl ? (
        <div className="flex items-start gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Loaf preview"
            className="h-20 w-20 object-cover rounded-md border border-stone-200"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-stone-500 truncate">{photoUrl}</p>
            <button
              type="button"
              onClick={clear}
              className="mt-2 text-xs text-stone-700 underline hover:text-stone-900"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-6 cursor-pointer hover:border-stone-500 ${
            busy ? "opacity-60 cursor-wait" : ""
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={onFileChange}
            disabled={busy}
            className="sr-only"
          />
          <span className="text-stone-700">
            {status.kind === "signing"
              ? "Preparing…"
              : status.kind === "uploading"
                ? `Uploading… ${status.progress}%`
                : "Click to choose a photo"}
          </span>
          <span className="text-xs text-stone-500">JPEG, PNG, or WebP</span>
        </label>
      )}

      {status.kind === "error" ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          Upload failed: {status.message}. Try again or paste a URL below.
        </p>
      ) : null}

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="text-stone-500 underline hover:text-stone-900"
        >
          {showManual ? "Hide URL field" : "Or paste a URL"}
        </button>
        {error ? <span className="text-red-600">{error}</span> : null}
      </div>

      {showManual ? (
        <input
          type="url"
          inputMode="url"
          value={photoUrl}
          onChange={(e) => {
            setPhotoUrl(e.target.value);
            setStatus(
              e.target.value
                ? { kind: "ready", publicUrl: e.target.value }
                : { kind: "idle" },
            );
          }}
          placeholder="https://…"
          className={fieldClass(error)}
        />
      ) : null}

      {/* The form action only reads this field — it's the single source of
          truth for the photo URL (file upload + manual entry both write here). */}
      <input type="hidden" name="photoUrl" value={photoUrl} readOnly />
    </div>
  );
}
