import fs from 'fs';
import path from 'path';

let loggedSdkFallback = false;
let s3ClientPromise = null;

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

async function getS3Client() {
  if (!s3ClientPromise) {
    s3ClientPromise = import('@aws-sdk/client-s3').then(({ S3Client }) => {
      const endpoint = process.env.S3_ENDPOINT || undefined;
      return new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint,
        forcePathStyle: Boolean(endpoint),
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY,
        },
      });
    });
  }
  return s3ClientPromise;
}

function localDest(key, localBaseDir) {
  const root = localBaseDir || path.join(process.cwd(), 'public', 'uploads');
  return path.join(root, ...String(key).split('/').filter(Boolean));
}

async function saveLocal({ buffer, key, publicUrlPath, localBaseDir }) {
  const dest = localDest(key, localBaseDir);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buffer);
  const url = publicUrlPath || `/uploads/${key}`;
  return { url, storage: 'local' };
}

async function saveS3({ buffer, key, contentType, publicUrlPath }) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await getS3Client();

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

async function readS3(key) {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await getS3Client();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    })
  );
  const bytes = await out.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Persist an upload buffer to S3/R2 when configured, otherwise local disk.
 * @param {{ buffer: Buffer, key: string, contentType?: string, publicUrlPath?: string, localBaseDir?: string }} opts
 * @returns {Promise<{ url: string, storage: 's3'|'local' }>}
 */
export async function saveUploadBuffer({ buffer, key, contentType, publicUrlPath, localBaseDir }) {
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
        return saveLocal({ buffer, key: normalizedKey, publicUrlPath, localBaseDir });
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

  return saveLocal({ buffer, key: normalizedKey, publicUrlPath, localBaseDir });
}

/**
 * Read a previously stored object. Returns null if missing.
 */
export async function readUploadBuffer(key, { localBaseDir } = {}) {
  const normalizedKey = String(key || '').replace(/^\/+/, '');
  if (!normalizedKey) return null;

  if (isObjectStorageEnabled()) {
    try {
      return await readS3(normalizedKey);
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode;
      if (status === 404 || err?.name === 'NoSuchKey' || err?.Code === 'NoSuchKey') {
        return null;
      }
      if (err?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find package '@aws-sdk\/client-s3'/.test(String(err?.message || err))) {
        // fall through to local
      } else {
        return null;
      }
    }
  }

  try {
    return await fs.promises.readFile(localDest(normalizedKey, localBaseDir));
  } catch {
    return null;
  }
}

export default { isObjectStorageEnabled, saveUploadBuffer, readUploadBuffer };
