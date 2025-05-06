import { NeynarAPIClient } from "@neynar/nodejs-sdk";

export abstract class Neynar {
  public client: NeynarAPIClient;

  constructor() {
    if (!process.env.NEYNAR_API_KEY) throw new Error("NEYNAR_API_KEY is not defined");

    this.client = new NeynarAPIClient({
      apiKey: process.env.NEYNAR_API_KEY,
    });
  }
}
