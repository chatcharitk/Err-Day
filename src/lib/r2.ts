/**
 * Cloudflare R2 storage (S3-compatible) — replaces Vercel Blob for photos
 * (receipts, LINE slips, customer/staff/branch images). Cheaper at scale and no
 * egress fees. Public reads are served from R2_PUBLIC_URL (the pub-….r2.dev
 * bucket URL); writes go through the S3 API with the account keys.
 *
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 *      R2_PUBLIC_URL.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region:   "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return _client;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_URL
  );
}

/** Upload bytes to R2 at `key` and return the public URL. */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await client().send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET,
    Key:         key,
    Body:        body,
    ContentType: contentType,
  }));
  return `${(process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "")}/${key}`;
}
