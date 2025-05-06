import { User } from "@neynar/nodejs-sdk/build/api";
import { Neynar } from "./base";

export class Users extends Neynar {
  constructor() {
    super();
  }

  public async getUsersByFids(fids: number[]): Promise<User[]> {
    return (await this.client.fetchBulkUsers({ fids })).users;
  }

  public async publishCast({ signerUuid, msg, embeds, channelId }: { signerUuid: string; msg: string; embeds: any[]; channelId?: string }): Promise<string> {
    const cast = await this.client.publishCast({
      signerUuid,
      text: msg,
      embeds,
      channelId,
    });

    return cast.cast.hash;
  }
}
