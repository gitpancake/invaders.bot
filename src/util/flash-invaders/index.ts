import axios, { AxiosInstance } from "axios";
import { Flash } from "../database/invader-flashes/types";

interface FlashInvaderResponse {
  with_paris: Flash[];
  without_paris: Flash[];
}

class SpaceInvadersAPI {
  private instance: AxiosInstance;
  public API_URL: string = "https://api.space-invaders.com";
  private lastRequestTime: number = 0;
  private consecutiveFailures: number = 0;

  constructor() {
    this.instance = axios.create({
      baseURL: this.API_URL,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
      },
      timeout: 10000,
    });
  }

  /**
   * Simulates human-like delay between requests
   */
  private async humanDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // If requests are too frequent, add a random delay
    if (timeSinceLastRequest < 2000) {
      const minDelay = 1000; // 1 second minimum
      const maxDelay = 3000; // 3 seconds maximum
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

      console.log(`Adding human-like delay: ${randomDelay}ms`);
      await new Promise((resolve) => setTimeout(resolve, randomDelay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Rotates User-Agent strings to appear more human-like
   */
  private getRandomUserAgent(): string {
    const userAgents = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ];

    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Implements exponential backoff for failed requests
   */
  private async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff: 2^attempt * 1000ms + random jitter
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        console.log(`Request failed, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error("Max retries exceeded");
  }

  public async getFlashes(): Promise<FlashInvaderResponse | null> {
    try {
      // Add human-like delay
      await this.humanDelay();

      // Update headers with random User-Agent
      this.instance.defaults.headers["User-Agent"] = this.getRandomUserAgent();

      // Add some randomness to request timing
      const response = await this.retryWithBackoff(async () => {
        return await this.instance.get<FlashInvaderResponse>(`/flashinvaders/flashes`);
      });

      // Reset failure counter on success
      this.consecutiveFailures = 0;

      return response.data;
    } catch (error) {
      this.consecutiveFailures++;
      console.error(`Failed to fetch flashes (consecutive failures: ${this.consecutiveFailures}):`, error);
      return null;
    }
  }
}

export default SpaceInvadersAPI;
