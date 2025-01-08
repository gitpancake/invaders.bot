import axios from "axios";
import { Flash } from "./types";

class SpaceInvaders {
  private API_URL: string = "https://api.space-invaders.com";
  public IMAGE_BASE: string = `${this.API_URL}`;

  public async getLatestFlashes(): Promise<{ with_paris: Flash[]; without_paris: Flash[] } | null> {
    try {
      const response = await axios.get<{ with_paris: Flash[]; without_paris: Flash[] }>(`${this.API_URL}/flashinvaders/flashes`);

      return {
        with_paris: response.data.with_paris,
        without_paris: response.data.without_paris,
      };
    } catch {
      return null;
    }
  }
}

export default SpaceInvaders;
