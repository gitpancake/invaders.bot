import axios, { AxiosInstance } from "axios";
import { Flash } from "../mongodb/invader-flashes/types";

interface FlashInvaderResponse {
  with_paris: Flash[];
  without_paris: Flash[];
}

class SpaceInvadersAPI {
  private instance: AxiosInstance;
  public API_URL: string = "https://api.space-invaders.com";

  constructor() {
    this.instance = axios.create({
      baseURL: this.API_URL,
    });
  }

  public async getFlashes(): Promise<FlashInvaderResponse | null> {
    try {
      const response = await this.instance.get<FlashInvaderResponse>(`/flashinvaders/flashes`);

      return response.data;
    } catch {
      return null;
    }
  }
}

export default SpaceInvadersAPI;
