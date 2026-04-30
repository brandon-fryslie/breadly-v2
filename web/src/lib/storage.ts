// Server-only storage helpers. Mints v4 signed PUT URLs for direct
// browser uploads to the photos bucket.
//
// Auth: ADC. Locally `gcloud auth application-default login`; on Cloud Run
// the runtime SA is resolved via the metadata server. The signer needs
// `roles/iam.serviceAccountTokenCreator` on itself so the SDK can call
// IAM SignBlob without a private key (see infra/envs/{dev,prod}/main.tf).
//
// The bucket is public-read at the IAM level (see infra/modules/storage),
// so the publicUrl returned here is durable: anyone who knows the URL can
// GET the object. We emit it from a single place to keep the URL shape
// authoritative. [LAW:one-source-of-truth]

import "server-only";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";

const SIGNED_PUT_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Allow-list — drives both server validation and the file picker's `accept`.
export const ALLOWED_PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type PhotoContentType = (typeof ALLOWED_PHOTO_CONTENT_TYPES)[number];

const EXT_BY_TYPE: Record<PhotoContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAllowedPhotoContentType(s: string): s is PhotoContentType {
  return (ALLOWED_PHOTO_CONTENT_TYPES as readonly string[]).includes(s);
}

let _storage: Storage | undefined;
function storage(): Storage {
  if (!_storage) _storage = new Storage();
  return _storage;
}

function photosBucketName(): string {
  const name = process.env.PHOTOS_BUCKET;
  if (!name) throw new Error("PHOTOS_BUCKET is not set");
  return name;
}

export type SignedPutUrl = {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  contentType: PhotoContentType;
  expiresAt: string; // ISO
};

// Signs a PUT URL for a fresh per-user object key. The key is the
// authoritative path on the bucket; publicUrl is derived from it.
export async function signListingPhotoPut(opts: {
  userId: string;
  contentType: PhotoContentType;
}): Promise<SignedPutUrl> {
  const bucket = photosBucketName();
  const ext = EXT_BY_TYPE[opts.contentType];
  const objectKey = `listings/${opts.userId}/${randomUUID()}.${ext}`;
  const expiresMs = Date.now() + SIGNED_PUT_TTL_MS;

  const [uploadUrl] = await storage()
    .bucket(bucket)
    .file(objectKey)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: expiresMs,
      contentType: opts.contentType,
    });

  return {
    uploadUrl,
    publicUrl: `https://storage.googleapis.com/${bucket}/${objectKey}`,
    objectKey,
    contentType: opts.contentType,
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

// Same shape as the public URL builder in signListingPhotoPut. Exposed so
// other code can derive the public URL from a key without re-signing.
export function publicPhotoUrl(objectKey: string): string {
  return `https://storage.googleapis.com/${photosBucketName()}/${objectKey}`;
}
