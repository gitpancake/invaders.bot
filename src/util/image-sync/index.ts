import axios from "axios";
import FormData from "form-data";

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
      const response = await axios.get<ArrayBuffer>(request.imageUrl, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data);

      const form = new FormData();
      form.append("key", String(request.key), {
        contentType: "text/plain",
      });
      form.append("file", buffer, {
        filename: "image.jpg",
        contentType: "image/jpeg",
      });

      const resp = await axios.post(`${this.IMAGE_UPLOAD_URL}/upload`, form, {
        headers: {
          ...form.getHeaders(),
          "x-api-key": this.LAMBDA_API_KEY,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (resp.status === 201) return 1;

      return 0;
    } catch (error) {
      console.error("Upload failed:", error);
      return 0;
    }
  }

  public async batchUpload(requests: InvaderFlash[], concurrency = 3): Promise<number> {
    let successCount = 0;

    const queue = [...requests];

    const runUpload = async () => {
      while (queue.length > 0) {
        const request = queue.shift();
        if (!request) break;

        try {
          const result = await this.upload(request);
          successCount += result;
        } catch (err) {
          console.error("Error in throttled upload:", err);
        }
      }
    };

    const workers = Array.from({ length: concurrency }).map(() => runUpload());

    await Promise.all(workers);

    return successCount;
  }
}
