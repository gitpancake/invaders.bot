import { User as NeynarUser } from "@neynar/nodejs-sdk/build/api";
import { Flash } from "../invader-flashes/types";

export interface Flashcastr {
  flash: Flash;
  user: NeynarUser;
  castHash: string | null;
}
