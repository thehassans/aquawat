import fs from 'fs';
import path from 'path';

let loggedSdkFallback = false;

/**
 * Object storage is enabled when bucket + credentials are configured.
 * Works with AWS S3 and R2-compatible endpoints (S3_ENDPOINT).
 */
export function isObjectStorageEnabled() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY &&
      process.env.S3_SECRET_KEY
  );
}

async function saveLocal({ buffer, key, publicUrlPath }) {
  const dest = path.join(process.cwd(), 'public', 'uploads', ...String(key).split('/').filter(Boolean));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buffer);
  const url = publicUrlPath || `/uploads/${key}`;
  return { url, storage: 'local' };
}

async function saveS3({ buffer, key, contentType, publicUrlPath }) {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const region = process.env.S3_REGION || 'auto';
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
  );

  const base = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
  const url = publicUrlPath || (base ? `${base}/${key}` : `/uploads/${key}`);
  return { url, storage: 's3' };
}

/**
 * Persist an upload buffer to S3/R2 when configured, otherwise local disk.
 * @param {{ buffer: Buffer, key: string, contentType?: string, publicUrlPath?: string }} opts
 * @returns {Promise<{ url: string, storage: 's3'|'local' }>}
 */
export async function saveUploadBuffer({ buffer, key, contentType, publicUrlPath }) {
  const normalizedKey = String(key || '').replace(/^\/+/, '');
  if (!normalizedKey) throw new Error('saveUploadBuffer: key is required');

  const requireObjectStorage = process.env.REQUIRE_OBJECT_STORAGE === 'true';
  const allowLocal =
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_LOCAL_UPLOADS === 'true' ||
    !requireObjectStorage;

  if (isObjectStorageEnabled()) {
    try {
      return await saveS3({
        buffer,
        key: normalizedKey,
        contentType,
        publicUrlPath,
      });
    } catch (err) {
      if (err?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find package '@aws-sdk\/client-s3'/.test(String(err?.message || err))) {
        if (!allowLocal) {
          throw new Error('Object storage SDK missing and local uploads are disabled in production');
        }
        if (!loggedSdkFallback) {
          loggedSdkFallback = true;
          console.warn('[objectStorage] @aws-sdk/client-s3 missing; falling back to local uploads');
        }
        return saveLocal({ buffer, key: normalizedKey, publicUrlPath });
      }
      throw err;
    }
  }

  if (!allowLocal) {
    throw new Error('Object storage (S3/R2) is required in production. Configure S3_* or set ALLOW_LOCAL_UPLOADS=true');
  }

  if (process.env.NODE_ENV === 'production' && !loggedSdkFallback) {
    loggedSdkFallback = true;
    console.warn('[objectStorage] Using local disk uploads — not multi-replica safe. Configure S3_* for SaaS scale.');
  }

  return saveLocal({ buffer, key: normalizedKey, publicUrlPath });
}

export default { isObjectStorageEnabled, saveUploadBuffer };
