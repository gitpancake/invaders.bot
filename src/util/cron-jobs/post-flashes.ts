import { getUnixTime, sub } from "date-fns";
import { InvadersFunHandler } from "../invaders.fun";
import { FlashesDb } from "../mongodb/flashes";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";

export class PostRandomFlashCron extends CronTask {
  constructor(schedule: string) {
    super("post-flash", schedule);
  }

  public async task(): Promise<void> {
    const hours = 1;

    try {
      const time_threshold = getUnixTime(sub(new Date(), { hours }));

      const randomFlash = await new FlashesDb().getRandomDocument({
        $or: [{ posted: true }, { posted: { $exists: false } }],
        timestamp: { $gte: time_threshold },
      });

      if (!randomFlash) {
        console.error(`No unposted flashes in last ${hours} hrs. ${formattedCurrentTime()}`);
        return;
      }

      await new InvadersFunHandler().sendToBot(randomFlash);

      await new FlashesDb().updateDocument(
        {
          flash_id: randomFlash.flash_id,
        },
        {
          posted: true,
        }
      );

      console.log(`Posted #${randomFlash.flash_id}. ${formattedCurrentTime()}`);
    } catch (err) {
      console.error(`Error fetching random flash:`, err);
    }
  }
}
