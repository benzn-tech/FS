import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const VIDEOS_BUCKET = process.env.S3_VIDEOS_BUCKET ?? 'fsai-videos'
const MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET ?? 'fsai-media'

const VIDEO_URL_EXPIRY_SECS = 15 * 60   // 15 minutes
const UPLOAD_URL_EXPIRY_SECS = 5 * 60   // 5 minutes

// Create a fresh S3Client per call so Amplify SSR runtime credentials
// (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN) are
// read from process.env at request time, not cached at module load time.
function makeS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION ?? 'ap-southeast-2',
    credentials: process.env.APP_AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
        }
      : undefined,
  })
}

// ---------------------------------------------------------------------------
// Generate a pre-signed GET URL for a session video (15 min expiry).
// The key is stored as `s3_video_key` on the sessions table.
// ---------------------------------------------------------------------------
export async function getSignedVideoUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: VIDEOS_BUCKET,
    Key: key,
  })
  return getSignedUrl(makeS3Client(), command, { expiresIn: VIDEO_URL_EXPIRY_SECS })
}

// ---------------------------------------------------------------------------
// Generate a pre-signed PUT URL for direct browser-to-S3 uploads (media bucket).
// Used by the admin media uploader.
// ---------------------------------------------------------------------------
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: MEDIA_BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(makeS3Client(), command, { expiresIn: UPLOAD_URL_EXPIRY_SECS })
}

// ---------------------------------------------------------------------------
// Upload a buffer directly from the server (used by the admin media API route
// when receiving a multipart upload rather than a pre-signed URL flow).
// ---------------------------------------------------------------------------
export async function uploadMediaBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await makeS3Client().send(
    new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )
  return `https://${MEDIA_BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-southeast-2'}.amazonaws.com/${key}`
}
