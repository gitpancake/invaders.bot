import { FlashcastrFlashesDb } from "../mongodb/flashcastr";
import { Flashcastr } from "../mongodb/flashcastr/types";
import { FlashesDb } from "../mongodb/flashes";
import { FlashcastrUsersDb } from "../mongodb/users";
import { NeynarUsers } from "../neynar/users";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";

export class HistoricFlashSyncCron extends CronTask {
  constructor(schedule: string) {
    super("historic-flash-sync", schedule);
  }

  public async task(): Promise<void> {
    try {
      const appUsers = await new FlashcastrUsersDb().getMany({ historic_sync: true });

      if (!appUsers.length) return;

      const uniqueFids = [...new Set(appUsers.map((u) => u.fid))];
      const neynarUsers = await new NeynarUsers().getUsersByFids(uniqueFids);
      const neynarByFid = new Map(neynarUsers.map((u) => [u.fid, u]));

      const docs: Flashcastr[] = [];

      for (const appUser of appUsers) {
        const flashes = await new FlashesDb().getMany({ player: appUser.username });

        const neynarUsr = neynarByFid.get(appUser.fid);
        if (!neynarUsr) continue;

        for (const flash of flashes) {
          docs.push({ flash, user: neynarUsr, castHash: null });
        }

        await new FlashcastrUsersDb().updateDocument({ fid: appUser.fid }, { $set: { historic_sync: false } });
      }

      if (docs.length) await new FlashcastrFlashesDb().insertMany(docs);

      console.log(`${docs.length} historic flashes processed for ${appUsers.length} users. ` + formattedCurrentTime());
    } catch (error) {
      console.error("historic-flash-sync cron failed:", error);
    }
  }
}
