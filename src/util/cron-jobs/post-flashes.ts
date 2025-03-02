import { getUnixTime, sub } from "date-fns";
import { InvadersFunHandler } from "../invaders.fun";
import MongoDBService from "../mongodb";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";

export class PostRandomFlashCron extends CronTask {
  constructor(schedule: string) {
    super("post-flash", schedule);
  }

  public async task(): Promise<void> {
    const mongo = new MongoDBService("flashes");

    try {
      await mongo.connect();

      const time_threshold = getUnixTime(sub(new Date(), { minutes: 30 }));

      const randomFlash = await mongo.getRandomDocument({
        $or: [
          { posted: true },
          { posted: { $exists: false } }, // Matches documents where `posted` is `null` or missing
        ],
        timestamp: { $gte: time_threshold },
      });

      if (!randomFlash) {
        console.error("No random flash from last 30 minutes was found.");
        return;
      }

      await new InvadersFunHandler().sendToBot(randomFlash);

      await mongo.updateDocument(
        {
          flash_id: randomFlash.flash_id,
        },
        {
          posted: true,
        }
      );

      console.log(`Posted #${randomFlash.flash_id}. ${formattedCurrentTime}`);
    } catch (err) {
      console.error("Error fetching random flash:", err);
    } finally {
      await mongo.disconnect();
    }
  }
}
