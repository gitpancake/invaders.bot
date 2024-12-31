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

  public async getRandomFlash(): Promise<Flash | null> {
    try {
      const flashes = await this.getLatestFlashes();

      if (!flashes) return null;

      return [...flashes.with_paris, ...flashes.without_paris].sort(() => 0.5 - Math.random())[0];
    } catch {
      return null;
    }
  }
}

export default SpaceInvaders;

/**
 * "img": "/media/queries/2024/12/29/image_mGJJwig.jpg",
"city": "Paris",
"text": "Paris, CHARLES_BEST",
"player": "CHARLES_BEST",
"flash_id": 76707905,
"timestamp": 1735465136.013294,
"flash_count": "30 658 715"
 */
