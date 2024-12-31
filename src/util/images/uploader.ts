import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import axios from "axios";
import { config } from "dotenv";

config({
  path: ".env",
});

interface UploadImageRequest {
  imageUrl: string;
  key: string;
}

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const uploadImageHandler = async (request: UploadImageRequest): Promise<string> => {
  const { imageUrl, key } = request;

  const bucketName = process.env.S3_BUCKET_NAME;

  try {
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
