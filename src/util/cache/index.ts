import { batchRequests } from "../batcher";
import { ImageDownloader } from "../images";
import { S3Service } from "../s3";

export interface InvaderFlash {
  imageUrl: string;
  key: string;
}

export class InvaderFlashCache {
  private S3_SERVICE: S3Service;
  private IMAGE_DOWNLOADER: ImageDownloader;

  constructor() {
    if (!process.env.S3_BUCKET_NAME) {
      throw new Error("Missing S3_BUCKET_NAME in .env file.");
    }

    this.S3_SERVICE = new S3Service({
      BUCKET_NAME: process.env.S3_BUCKET_NAME,
    });

    this.IMAGE_DOWNLOADER = new ImageDownloader();
  }

  private async upload(request: InvaderFlash): Promise<number> {
    const { imageUrl, key } = request;

    const exists = await this.S3_SERVICE.objectExists(key);

    if (exists) {
      return 0;
    }

    const { buffer, contentType } = await this.IMAGE_DOWNLOADER.downloadImage(imageUrl);

    const uploaded = await this.S3_SERVICE.putBufferObject(buffer, contentType, key);

    if (!uploaded) {
      throw new Error("Failed to upload image to S3");
    }

    return 1;
  }

  public async batchUpload(requests: InvaderFlash[], batchSize: number = 45): Promise<number> {
    try {
      const batches = batchRequests(requests, batchSize);

      let count = 0;

      for (const batch of batches) {
        const result = await Promise.all(batch.map((request) => this.upload(request)));

        count += result.reduce((total, count) => total + count, 0);
      }

      return count;
    } catch (error) {
      console.error("Error uploading images:", error);
      throw error;
    }
  }
}
