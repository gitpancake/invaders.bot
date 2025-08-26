import axios, { AxiosInstance } from "axios";
import { Flash } from "../database/invader-flashes/types";
import * as http from "http";
import * as https from "https";

interface FlashInvaderResponse {
  with_paris: Flash[];
  without_paris: Flash[];
}

class SpaceInvadersAPI {
  private instance: AxiosInstance;
  public API_URL: string = "https://api.space-invaders.com";
  private lastRequestTime: number = 0;
  private consecutiveFailures: number = 0;
  private sessionStartTime: number = Date.now();
  private requestCount: number = 0;

  constructor() {
    this.instance = axios.create({
      baseURL: this.API_URL,
      timeout: this.getRandomTimeout(),
    });
  }

  private getRandomTimeout(): number {
    return Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000;
  }

  private getRandomUserAgent(): string {
    const browsers = [
      // Chrome versions 119-124 on different platforms
      {
        base: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
        versions: ["124.0.0.0", "123.0.0.0", "122.0.0.0", "121.0.0.0", "120.0.0.0", "119.0.0.0"]
      },
      {
        base: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        versions: ["124.0.0.0", "123.0.0.0", "122.0.0.0", "121.0.0.0", "120.0.0.0", "119.0.0.0"]
      },
      {
        base: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)",
        versions: ["124.0.0.0", "123.0.0.0", "122.0.0.0", "121.0.0.0", "120.0.0.0"]
      },
      {
        base: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko)",
        versions: ["Version/17.1 Safari/605.1.15", "Version/17.0 Safari/605.1.15"]
      },
      // Firefox versions
      {
        base: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101",
        versions: ["Firefox/122.0", "Firefox/121.0", "Firefox/120.0"]
      },
      {
        base: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101",
        versions: ["Firefox/122.0", "Firefox/121.0", "Firefox/120.0"]
      },
      // Edge
      {
        base: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        versions: ["124.0.0.0 Safari/537.36 Edg/124.0.0.0", "123.0.0.0 Safari/537.36 Edg/123.0.0.0"]
      }
    ];

    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const version = browser.versions[Math.floor(Math.random() * browser.versions.length)];
    
    if (browser.base.includes("Chrome") || browser.base.includes("Edg")) {
      return `${browser.base} Chrome/${version} Safari/537.36`;
    }
    
    return `${browser.base} ${version}`;
  }

  private getRandomAcceptLanguage(): string {
    const languages = [
      "en-US,en;q=0.9",
      "en-GB,en;q=0.9",
      "en-US,en;q=0.9,fr;q=0.8",
      "en-US,en;q=0.9,es;q=0.8",
      "en-US,en;q=0.9,de;q=0.8",
      "en,en-GB;q=0.9,en-US;q=0.8",
      "en-US,en;q=0.9,fr;q=0.8,de;q=0.7",
      "en-GB,en-US;q=0.9,en;q=0.8",
      "en-US,en;q=0.8",
      "en;q=0.9,en-US;q=0.8"
    ];
    
    return languages[Math.floor(Math.random() * languages.length)];
  }

  private getRandomSecChUa(): string {
    const chromeVersions = [
      '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      '"Chromium";v="123", "Google Chrome";v="123", "Not.A/Brand";v="8"',
      '"Chromium";v="122", "Google Chrome";v="122", "Not(A:Brand";v="24"',
      '"Chromium";v="121", "Google Chrome";v="121", "Not A(Brand";v="99"',
      '"Chromium";v="120", "Google Chrome";v="120", "Not_A Brand";v="8"',
      '"Google Chrome";v="124", "Chromium";v="124", "Not-A.Brand";v="99"',
      '"Microsoft Edge";v="124", "Chromium";v="124", "Not-A.Brand";v="99"',
      '"Microsoft Edge";v="123", "Chromium";v="123", "Not.A/Brand";v="8"'
    ];
    
    return chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
  }

  private getRandomSecChUaPlatform(): string {
    const platforms = ['"macOS"', '"Windows"', '"Linux"', '"Chrome OS"'];
    return platforms[Math.floor(Math.random() * platforms.length)];
  }

  private getRandomReferer(): string | undefined {
    const referers = [
      undefined,
      "https://api.space-invaders.com/",
      "https://api.space-invaders.com/flashinvaders",
      "https://space-invaders.com/",
      "https://space-invaders.com/flashinvaders",
      "https://www.google.com/",
      "https://www.google.com/search?q=space+invaders",
      undefined,
      undefined
    ];
    
    return referers[Math.floor(Math.random() * referers.length)];
  }

  private getRandomAcceptEncoding(): string {
    const encodings = [
      "gzip, deflate, br",
      "gzip, deflate, br, zstd",
      "gzip, deflate",
      "br, gzip, deflate",
      "gzip, deflate, br;q=1.0, *;q=0.5"
    ];
    
    return encodings[Math.floor(Math.random() * encodings.length)];
  }

  private shouldIncludeHeader(probability: number): boolean {
    return Math.random() < probability;
  }

  private getRandomHeaders(): Record<string, string> {
    const userAgent = this.getRandomUserAgent();
    const isChrome = userAgent.includes("Chrome");
    const isFirefox = userAgent.includes("Firefox");
    const isSafari = userAgent.includes("Safari") && !userAgent.includes("Chrome");
    
    const headers: Record<string, string> = {
      "User-Agent": userAgent,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": this.getRandomAcceptLanguage(),
      "Accept-Encoding": this.getRandomAcceptEncoding(),
    };

    // Connection headers
    if (this.shouldIncludeHeader(0.8)) {
      headers["Connection"] = Math.random() < 0.7 ? "keep-alive" : "close";
    }

    // DNT header (Do Not Track)
    if (this.shouldIncludeHeader(0.4)) {
      headers["DNT"] = "1";
    }

    // Cache headers
    if (this.shouldIncludeHeader(0.3)) {
      headers["Cache-Control"] = Math.random() < 0.5 ? "no-cache" : "max-age=0";
    }
    
    if (this.shouldIncludeHeader(0.2)) {
      headers["Pragma"] = "no-cache";
    }

    // Security headers (Chrome/Edge specific)
    if (isChrome && this.shouldIncludeHeader(0.9)) {
      headers["Sec-Ch-Ua"] = this.getRandomSecChUa();
      headers["Sec-Ch-Ua-Mobile"] = "?0";
      headers["Sec-Ch-Ua-Platform"] = this.getRandomSecChUaPlatform();
      headers["Sec-Fetch-Dest"] = "empty";
      headers["Sec-Fetch-Mode"] = "cors";
      headers["Sec-Fetch-Site"] = Math.random() < 0.7 ? "same-origin" : "cross-site";
    }

    // Referer
    const referer = this.getRandomReferer();
    if (referer) {
      headers["Referer"] = referer;
    }

    // Origin (sometimes)
    if (this.shouldIncludeHeader(0.15)) {
      headers["Origin"] = "https://api.space-invaders.com";
    }

    // Firefox specific
    if (isFirefox && this.shouldIncludeHeader(0.3)) {
      headers["Upgrade-Insecure-Requests"] = "1";
    }

    // Random viewport hints (occasional)
    if (this.shouldIncludeHeader(0.1)) {
      const viewports = ["1920", "1366", "1440", "1536", "1280", "2560"];
      headers["Viewport-Width"] = viewports[Math.floor(Math.random() * viewports.length)];
    }

    // Session tracking prevention
    if (this.shouldIncludeHeader(0.05)) {
      headers["Sec-GPC"] = "1";
    }

    return headers;
  }

  private shuffleHeaders(headers: Record<string, string>): Record<string, string> {
    const entries = Object.entries(headers);
    
    // Keep User-Agent first (common pattern)
    const userAgentIndex = entries.findIndex(([key]) => key === "User-Agent");
    const userAgent = entries.splice(userAgentIndex, 1)[0];
    
    // Shuffle remaining headers
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    
    // Reconstruct with User-Agent first
    return Object.fromEntries([userAgent, ...entries]);
  }

  private async humanDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Different delay patterns based on session age and request count
    const sessionAge = now - this.sessionStartTime;
    const isNewSession = sessionAge < 60000; // First minute
    const isBursty = this.requestCount % 10 < 3; // First 3 requests of every 10
    
    let minDelay: number;
    let maxDelay: number;
    
    if (isNewSession) {
      // New sessions are more cautious
      minDelay = 3000;
      maxDelay = 8000;
    } else if (isBursty) {
      // Simulate bursty behavior
      minDelay = 500;
      maxDelay = 2000;
    } else {
      // Normal behavior
      minDelay = 1500;
      maxDelay = 5000;
    }
    
    // Add extra delay if we're making requests too fast
    if (timeSinceLastRequest < minDelay) {
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      
      // Add gaussian-like jitter
      const jitter = (Math.random() + Math.random() + Math.random()) / 3 * 500 - 250;
      const finalDelay = Math.max(500, randomDelay + jitter);
      
      console.log(`Adding human-like delay: ${Math.round(finalDelay)}ms (pattern: ${isNewSession ? 'new-session' : isBursty ? 'burst' : 'normal'})`);
      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
    
    // Occasionally pause for longer (simulating user distraction)
    if (Math.random() < 0.05) {
      const longPause = Math.floor(Math.random() * 10000) + 10000; // 10-20 seconds
      console.log(`Simulating user distraction: ${longPause}ms pause`);
      await new Promise((resolve) => setTimeout(resolve, longPause));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        // More variable backoff with humanized patterns
        const baseDelay = Math.pow(1.5 + Math.random() * 0.5, attempt) * 1000;
        const jitter = Math.random() * 2000;
        const humanFactor = Math.random() < 0.3 ? Math.random() * 3000 : 0; // Sometimes add extra human hesitation
        const delay = baseDelay + jitter + humanFactor;

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

      // Generate and shuffle headers for this request
      const headers = this.shuffleHeaders(this.getRandomHeaders());
      
      // Create a new axios instance for this request with random configuration
      const requestInstance = axios.create({
        baseURL: this.API_URL,
        headers,
        timeout: this.getRandomTimeout(),
        // Randomly decide on keepAlive with proper Agent instances
        httpAgent: Math.random() < 0.7 ? undefined : new http.Agent({ keepAlive: false }),
        httpsAgent: Math.random() < 0.7 ? undefined : new https.Agent({ keepAlive: false }),
        maxRedirects: Math.floor(Math.random() * 3) + 3, // 3-5 redirects
        validateStatus: (status) => status >= 200 && status < 300,
      });

      console.log(`Making request with User-Agent: ${headers["User-Agent"].substring(0, 50)}...`);
      
      // Make the request with retry logic
      const response = await this.retryWithBackoff(async () => {
        return await requestInstance.get<FlashInvaderResponse>(`/flashinvaders/flashes`);
      });

      // Reset failure counter on success
      this.consecutiveFailures = 0;

      // Occasionally reset session metrics to appear as new session
      if (Math.random() < 0.02) {
        console.log("Simulating session reset");
        this.sessionStartTime = Date.now();
        this.requestCount = 0;
      }

      return response.data;
    } catch (error) {
      this.consecutiveFailures++;
      console.error(`Failed to fetch flashes (consecutive failures: ${this.consecutiveFailures}):`, error);
      
      // If we have too many consecutive failures, reset session
      if (this.consecutiveFailures > 5) {
        console.log("Too many failures, resetting session parameters");
        this.sessionStartTime = Date.now();
        this.requestCount = 0;
        this.consecutiveFailures = 0;
      }
      
      return null;
    }
  }
}

export default SpaceInvadersAPI;