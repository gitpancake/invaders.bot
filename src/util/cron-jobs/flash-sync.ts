import { getUnixTime } from "date-fns";
import { config } from "dotenv";
import { FlashcastrFlashesDb } from "../database/flashcastr-flashes";
import { FlashcastrFlash } from "../database/flashcastr-flashes/types";
import { FlashcastrUsersDb } from "../database/flashcastr-users";
import { PostgresFlashesDb } from "../database/invader-flashes";
import { decrypt } from "../encrypt";
import { NeynarUsers } from "../neynar/users";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";

config({ path: ".env" });

export class FlashSyncCron extends CronTask {
  private static flashTimespanMins = 60; // 1 hour lookback

  constructor(schedule: string) {
    super("flash-sync", schedule);
  }

  public async task(): Promise<void> {
    return FlashSyncCron.executeTask();
  }

  public static async executeTask(): Promise<void> {
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
      const sinceUnix = getUnixTime(new Date(Date.now() - FlashSyncCron.flashTimespanMins * 60_000));
      const flashes = await new PostgresFlashesDb().getSinceByPlayers(
        sinceUnix,
        [...usersByUsername.keys()].map((u) => u.toLowerCase())
      );
      if (!flashes.length) return;

      /* ------------------------------------------------------------------ */
      /* 3.  Remove flashes we already processed                            */
      /* ------------------------------------------------------------------ */
      const flashIds = flashes.map((f) => f.flash_id);
      const flashcastrFlashesDb = new FlashcastrFlashesDb();
      const alreadyStored = await flashcastrFlashesDb.getByFlashIds(flashIds);
      const newFlashes = flashes.filter((f) => !alreadyStored.some((e) => e.flash_id === f.flash_id));
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
      const docs: FlashcastrFlash[] = [];

      for (const flash of newFlashes) {
        const appUser = [...usersByUsername.entries()].find(([username]) => username.toLowerCase() === flash.player.toLowerCase())?.[1];
        if (!appUser) continue; // should not happen

        const neynarUsr = neynarByFid.get(appUser.fid);
        if (!neynarUsr) continue;

        let castHash: string | null = null;
        if (appUser.auto_cast) {
          // Only cast if IPFS hash is populated
          if (!flash.ipfs_cid || flash.ipfs_cid.trim() === '') {
            console.log(`Skipping auto-cast for flash ${flash.flash_id} - IPFS hash not yet populated`);
            continue;
          }

          try {
            const decryptionKey = process.env.SIGNER_ENCRYPTION_KEY;

            if (!decryptionKey) throw new Error("SIGNER_ENCRYPTION_KEY is not defined");

            castHash = await publisher.publishCast({
              signerUuid: decrypt(appUser.signer_uuid, decryptionKey),
              msg: `I just flashed an Invader in ${flash.city}! 👾`,
              embeds: [{ url: `https://www.flashcastr.app/flash/${flash.flash_id}` }],
              channelId: "invaders",
            });
          } catch (err) {
            console.error("Failed to auto-cast:", err);
            throw err;
          }
        }

        docs.push({
          flash_id: flash.flash_id,
          user_fid: appUser.fid,
          user_pfp_url: neynarUsr.pfp_url ?? "",
          user_username: neynarUsr.username,
          cast_hash: castHash,
        });
      }

      /* ------------------------------------------------------------------ */
      /* 6.  Persist & log                                                  */
      /* ------------------------------------------------------------------ */
      if (docs.length) await flashcastrFlashesDb.insertMany(docs);

      console.log(`${docs.length} flashes processed, ` + `${docs.filter((d) => d.cast_hash).length} auto-casts. ` + formattedCurrentTime());
    } catch (error) {
      console.error("flash-sync cron failed:", error);
    }
  }
}
