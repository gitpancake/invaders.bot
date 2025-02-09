import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import axios from "axios";
import { config } from "dotenv";

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

export const uploadImagesInBatches = async (requests: UploadImageRequest[], batchSize: number): Promise<string[]> => {
  // console.log(`Uploading ${requests.length} images in batches of ${batchSize}`);

  const results: string[] = [];

  const chunkArray = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  const batches = chunkArray(requests, batchSize);

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (request) => {
        try {
          return await uploadImageHandler(request);
        } catch (error) {
          console.error(`Error processing ${request.key}:`, error);
          return null;
        }
      })
    );
    results.push(...(batchResults.filter((result) => result !== null) as string[]));

    // console.log(`Uploaded ${results.length} images`);
  }

  return results;
};

export const uploadImageHandler = async (request: UploadImageRequest): Promise<string> => {
  const { imageUrl, key } = request;
  const bucketName = process.env.S3_BUCKET_NAME;

  try {
    // Check if the object already exists in S3
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key.slice(1),
      });

      await s3Client.send(headCommand);

      // Return the existing S3 URL without re-uploading
      return `https://${bucketName}.s3.amazonaws.com${key}`;
    } catch (headError) {
      //@ts-ignore
      if (headError.name !== "NotFound") {
        console.error("Error checking object existence:", headError);
        throw new Error("Failed to check if the image exists in S3");
      }
      // Proceed with upload if object is not found
    }

    // Step 1: Download the image
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(response.data);

    // Step 2: Upload the image to S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key.slice(1),
      Body: imageBuffer,
      ContentType: response.headers["content-type"], // Use the original content type
      ACL: "public-read", // Make the object publicly readable
    });

    await s3Client.send(command);

    // Return the S3 object URL
    const s3Url = `https://${bucketName}.s3.amazonaws.com${key}`;
    return s3Url;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw new Error("Failed to upload image to S3");
  }
};
