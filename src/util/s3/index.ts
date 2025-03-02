import { HeadObjectCommand, ObjectCannedACL, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { config } from "dotenv";
import https from "https";

config({
  path: ".env",
});

export class S3Service {
  private BUCKET_NAME: string;
  private client: S3Client;

  constructor({ BUCKET_NAME }: { BUCKET_NAME?: string }) {
    if (!BUCKET_NAME) {
      throw new Error("Bucket name and key are required.");
    }

    this.BUCKET_NAME = BUCKET_NAME;

    this.client = new S3Client({
      region: process.env.AWS_REGION,
      requestHandler: new NodeHttpHandler({
        requestTimeout: 30_000,
        socketAcquisitionWarningTimeout: 10_000,

        httpsAgent: new https.Agent({
          maxTotalSockets: 1000,
          maxSockets: 1000,
          keepAlive: true,
        }),
      }),
    });
  }

  public async objectExists(key: string): Promise<boolean> {
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.BUCKET_NAME,
        Key: key.slice(1),
      });

      await this.client.send(headCommand);

      return true;
    } catch (error: any) {
      if (error.name !== "NotFound") {
        console.error("Error checking object existence:", error);
        throw new Error("Failed to check if the image exists in S3");
      }

      return false;
    }
  }

  public async putBufferObject(buffer: Buffer, contentType: string, key: string, acl: ObjectCannedACL = "public-read"): Promise<boolean> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.BUCKET_NAME,
        Key: key.slice(1),
        Body: buffer,
        ContentType: contentType, // Use the original content type
        ACL: acl, // Make the object publicly readable
      });

      await this.client.send(command);

      return true;
    } catch (error: any) {
      console.error("Error putting object:", error);
      throw new Error("Failed to put object in S3");
    }
  }
}
