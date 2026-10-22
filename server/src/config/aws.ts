import "dotenv/config";
import { S3Client } from "@aws-sdk/client-s3";
export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(process.env.AWS_ACCESS_KEY && process.env.AWS_SECRET_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY,
          secretAccessKey: process.env.AWS_SECRET_KEY,
        },
      }
    : {}),
});
