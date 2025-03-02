import { getUnixTime, sub } from "date-fns";
import cron from "node-cron";
import { InvadersFunHandler } from "../invaders.fun";
import MongoDBService from "../mongodb";
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
        posted: false,
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
    } catch (err) {
      console.error("Error fetching random flash:", err);
    } finally {
      await mongo.disconnect();
    }
  }

  public register(): void {
    console.log(`Registering ${this.name} cron job`);

    cron.schedule(this.schedule, async () => {
      console.log(`Refreshing channel casts`);
      await this.task();
    });
  }
}
