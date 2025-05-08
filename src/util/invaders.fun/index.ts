import axios, { AxiosInstance } from "axios";
import { Flash } from "../flash-invaders/types";

export class InvadersFunHandler {
  private instance: AxiosInstance;

  constructor() {
    if (!process.env.API_URL) {
      throw new Error("API_URL is not defined in the environment variables.");
    }

    if (!process.env.WEBHOOK_SECRET) {
      throw new Error("WEBHOOK_SECRET is not defined in the environment variables.");
    }

    this.instance = axios.create({
      baseURL: process.env.API_URL,
      headers: {
        "x-api-key": process.env.WEBHOOK_SECRET,
      },
    });
  }

  public async sendToBot(flash: Flash): Promise<void> {
    try {
      await this.instance.post(`/api/bot`, {
        flash,
      });
    } catch (error) {
      console.error(`Error posting flash ${flash.flash_id}:`, error);
      throw error;
    }
  }
}
