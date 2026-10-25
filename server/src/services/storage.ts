import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { put, get, del, issueSignedToken, presignUrl } from "@vercel/blob";
import { s3 } from "../config/aws";
import { HttpError } from "../lib/errors";

const blobPrefix = "vercel-blob:";
function bucket() {
  if (!process.env.AWS_BUCKET_NAME)
    throw new HttpError(503, "Resume storage is not configured");
  return process.env.AWS_BUCKET_NAME;
}
export async function storeResume(key: string, bytes: Buffer) {
  if (process.env.BLOB_STORE_ID) {
    await put(key, bytes, {
      access: "private",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });
    return blobPrefix + key;
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: bytes,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
    }),
  );
  return key;
}
export async function removeResume(key: string) {
  if (key.startsWith(blobPrefix)) await del(key.slice(blobPrefix.length));
  else await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function resumeDownloadUrl(key: string) {
  if (key.startsWith(blobPrefix)) {
    const pathname = key.slice(blobPrefix.length),
      validUntil = Date.now() + 60000;
    const token = await issueSignedToken({
      pathname,
      operations: ["get"],
      validUntil,
    });
    return (
      await presignUrl(token, {
        operation: "get",
        pathname,
        access: "private",
        validUntil,
      })
    ).presignedUrl;
  }
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: 'attachment; filename="resume.pdf"',
    }),
    { expiresIn: 60 },
  );
}
export async function readResume(key: string) {
  if (key.startsWith(blobPrefix)) {
    const result = await get(key.slice(blobPrefix.length), {
      access: "private",
      useCache: false,
    });
    if (result?.statusCode !== 200)
      throw new HttpError(400, "Resume could not be read");
    if (result.blob.size > 5 * 1024 * 1024)
      throw new HttpError(400, "Resume exceeds analysis size limit");
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }
  const result = await s3.send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if ((result.ContentLength ?? 0) > 5 * 1024 * 1024)
    throw new HttpError(400, "Resume exceeds analysis size limit");
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new HttpError(400, "Resume could not be read");
  return bytes;
}
