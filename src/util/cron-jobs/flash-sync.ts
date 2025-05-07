import { getUnixTime } from "date-fns";
import { config } from "dotenv";
import { decrypt } from "../encrypt";
import { FlashcastrFlashesDb } from "../mongodb/flashcastr";
import { Flashcastr } from "../mongodb/flashcastr/types";
import { FlashesDb } from "../mongodb/flashes";
import { FlashcastrUsersDb } from "../mongodb/users";
import { NeynarUsers } from "../neynar/users";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";

config({ path: ".env" });

export class FlashSyncCron extends CronTask {
  private flashTimespanMins = 5;

  constructor(schedule: string) {
    super("flash-sync", schedule);
  }

  public async task(): Promise<void> {
    try {
      /* ------------------------------------------------------------------ */
      /* 1.  Fetch registered users                                         */
      /* ------------------------------------------------------------------ */
      const users = await new FlashcastrUsersDb().getMany({});
      if (!users.length) return;

      const usersByUsername = new Map(users.map((u) => [u.username, u]));

      /* ------------------------------------------------------------------ */
      /* 2.  Fetch flashes from the last N minutes                          */
      /* ------------------------------------------------------------------ */
      const sinceUnix = getUnixTime(new Date(Date.now() - this.flashTimespanMins * 60_000));
      const flashes = await new FlashesDb().getMany({
        timestamp: { $gte: sinceUnix }, // use $gte, not $lte
        player: { $in: [...usersByUsername.keys()] },
      });
      if (!flashes.length) return;

      /* ------------------------------------------------------------------ */
      /* 3.  Remove flashes we already processed                            */
      /* ------------------------------------------------------------------ */
      const flashIds = flashes.map((f) => f.flash_id);
      const flashcastrFlashesDb = new FlashcastrFlashesDb();
      const alreadyStored = await flashcastrFlashesDb.getMany({ "flash.flash_id": { $in: flashIds } });
      const newFlashes = flashes.filter((f) => !alreadyStored.some((e) => e.flash.flash_id === f.flash_id));
      if (!newFlashes.length) return;

      /* ------------------------------------------------------------------ */
      /* 4.  Fetch Neynar profiles (dedup with Set for speed)               */
      /* ------------------------------------------------------------------ */
      const uniqueFids = [...new Set(users.map((u) => u.fid))];
      const neynarUsers = await new NeynarUsers().getUsersByFids(uniqueFids);
      const neynarByFid = new Map(neynarUsers.map((u) => [u.fid, u]));

      /* ------------------------------------------------------------------ */
      /* 5.  Build flash-documents & optionally publish auto-casts          */
      /* ------------------------------------------------------------------ */
      const publisher = new NeynarUsers(); // reuse 1 instance
      const docs: Flashcastr[] = [];

      for (const flash of newFlashes) {
        const appUser = usersByUsername.get(flash.player);
        if (!appUser) continue; // should not happen

        const neynarUsr = neynarByFid.get(appUser.fid);
        if (!neynarUsr) continue;

        let castHash: string | null = null;
        if (appUser.auto_cast) {
          try {
            const decryptionKey = process.env.SIGNER_ENCRYPTION_KEY;

            if (!decryptionKey) throw new Error("SIGNER_ENCRYPTION_KEY is not defined");

            castHash = await publisher.publishCast({
              signerUuid: decrypt(appUser.signer_uuid, decryptionKey),
              msg: `I just flashed an Invader in ${flash.city}! 👾`,
              embeds: [{ url: `${process.env.S3_URL}${flash.img}` }],
              channelId: "invaders",
            });
          } catch (err) {
            console.error("Failed to auto-cast:", err);
          }
        }

        docs.push({ flash, user: neynarUsr, castHash });
      }

      /* ------------------------------------------------------------------ */
      /* 6.  Persist & log                                                  */
      /* ------------------------------------------------------------------ */
      if (docs.length) await flashcastrFlashesDb.insertMany(docs);

      console.log(`${docs.length} flashes processed, ` + `${docs.filter((d) => d.castHash).length} auto-casts. ` + formattedCurrentTime());
    } catch (error) {
      console.error("flash-sync cron failed:", error);
    }
  }
}
