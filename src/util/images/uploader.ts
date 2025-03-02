import { S3Client } from "@aws-sdk/client-s3";
import { config } from "dotenv";
import { ImageDownloader } from ".";
import { batchRequests } from "../batcher";
import { S3Service } from "../s3";

config({
  path: ".env",
});

interface UploadImageRequest {
  imageUrl: string;
  key: string;
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

export const batchUpload = async (requests: UploadImageRequest[], batchSize: number): Promise<string[]> => {
  // console.log(`Uploading ${requests.length} images in batches of ${batchSize}`);

  const batches = batchRequests(requests, batchSize);

  const results = await Promise.all(
    batches.flatMap((batch) => batch.map(upload)) // `flatMap` removes extra nesting
  );

  return results;
};

export const upload = async (request: UploadImageRequest): Promise<string> => {
  const { imageUrl, key } = request;
  const { S3_BUCKET_NAME } = process.env;

  const s3 = new S3Service({
    BUCKET_NAME: S3_BUCKET_NAME,
  });

  const exists = await s3.objectExists(key);

  if (exists) {
    return `https://${S3_BUCKET_NAME}.s3.amazonaws.com${key}`;
  }

  const { buffer, contentType } = await new ImageDownloader().downloadImage(imageUrl);

  const uploaded = await s3.putBufferObject(buffer, contentType, key);

  if (!uploaded) {
    throw new Error("Failed to upload image to S3");
  }

  return `https://${S3_BUCKET_NAME}.s3.amazonaws.com${key}`;
};
