import { User as NeynarUser } from "@neynar/nodejs-sdk/build/api";
import { Flash } from "../../flash-invaders/types";

export interface Flashcastr {
  flash: Flash;
  user: NeynarUser;
}
