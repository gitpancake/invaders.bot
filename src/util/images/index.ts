import axios, { AxiosInstance } from "axios";

export class ImageDownloader {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      responseType: "arraybuffer",
    });
  }

  public async downloadImage(url: string): Promise<{
    buffer: Buffer;
    contentType: string;
  }> {
    try {
      const response = await this.instance.get(url);

      return {
        buffer: Buffer.from(response.data),
        contentType: response.headers["content-type"],
      };
    } catch (error) {
      console.error("Error downloading image:", error);
      throw new Error("Failed to download image");
    }
  }
}
