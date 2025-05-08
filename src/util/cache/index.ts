import axios, { AxiosError } from "axios";

export interface InvaderFlash {
  imageUrl: string;
  key: string;
}

export class InvaderFlashCache {
  private IMAGE_UPLOAD_URL: string;
  private LAMBDA_API_KEY: string;

  constructor() {
    if (!process.env.IMAGE_UPLOAD_URL || !process.env.LAMBDA_API_KEY) {
      throw new Error("IMAGE_UPLOAD_URL and LAMBDA_API_KEY must be set");
    }

    this.IMAGE_UPLOAD_URL = process.env.IMAGE_UPLOAD_URL;
    this.LAMBDA_API_KEY = process.env.LAMBDA_API_KEY;
  }

  private async upload(request: InvaderFlash): Promise<number> {
    try {
      // Step 1: Download the image to a buffer
      const response = await axios.get<ArrayBuffer>(request.imageUrl, {
        responseType: "arraybuffer",
      });

      const base64Buffer = Buffer.from(response.data).toString("base64");

      // Step 2: Send base64 + key to Lambda
      const resp = await axios.post(
        `${this.IMAGE_UPLOAD_URL}/upload`,
        {
          body: {
            buffer: base64Buffer,
            key: request.key,
          },
        },
        {
          headers: {
            "x-api-key": this.LAMBDA_API_KEY, // Replace with your real key
          },
        }
      );

      console.log({ resp });
      if (resp.status === 201) return 1;

      return 0;
    } catch (ex) {
      if (ex instanceof AxiosError) {
        console.error("Upload failed:", ex.response?.data || ex.message || ex);
      } else {
        console.error("Upload failed:", ex);
      }
      return 0;
    }
  }

  public async batchUpload(requests: InvaderFlash[]): Promise<number> {
    try {
      const result = await Promise.all(requests.map((request) => this.upload(request)));

      const sum = result.reduce((total, count) => total + count, 0);

      return sum;
    } catch (error) {
      console.error("Error uploading images:", error);
      throw error;
    }
  }
}
