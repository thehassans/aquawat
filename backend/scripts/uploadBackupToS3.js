import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node uploadBackupToS3.js <backup-file>');
  process.exit(1);
}

const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;
if (!bucket || !accessKeyId || !secretAccessKey) {
  console.log('S3 backup skipped — S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY not set');
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  console.error(`Backup file not found: ${filePath}`);
  process.exit(1);
}

const endpoint = process.env.S3_ENDPOINT || undefined;
const client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint,
  forcePathStyle: Boolean(endpoint),
  credentials: { accessKeyId, secretAccessKey },
});

const key = `backups/${path.basename(filePath)}`;
await client.send(new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  Body: fs.createReadStream(filePath),
  ContentType: 'application/gzip',
}));

console.log(`Uploaded backup to s3://${bucket}/${key}`);
