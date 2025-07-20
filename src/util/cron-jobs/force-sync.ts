import { config } from "dotenv";
import { PostgresFlashesDb } from "../database/invader-flashes";
import { RabbitImagePush } from "../rabbitmq";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";

config({ path: ".env" });

export class ForceSyncCron extends CronTask {
  private sinceDate: Date;
  constructor(sinceDate: Date) {
    super("force-sync", "*/5 * * * *");
    this.sinceDate = sinceDate;
  }

  public async task(): Promise<void> {
    const sinceUnix = Math.floor(this.sinceDate.getTime() / 1000);
    try {
      const flashes = await new PostgresFlashesDb().getSince(sinceUnix);

      if (!flashes.length) {
        console.error(`No flashes found since ${this.sinceDate.toISOString()}. ${formattedCurrentTime()}`);
        throw new Error("No flashes found since " + this.sinceDate.toISOString());
      }

      console.log(`Found ${flashes.length} flashes since ${this.sinceDate.toISOString()}. Starting force push...`);
      const rabbit = new RabbitImagePush();
      let idx = 0;
      const batchSize = 500;
      while (idx < flashes.length) {
        const batch = flashes.slice(idx, idx + batchSize);
        await Promise.all(
          batch.map(async (flash) => {
            try {
              await rabbit.publish(flash);
            } catch (err) {
              console.error(`Failed to publish flash_id ${flash.flash_id}:`, err);
            }
          })
        );
        idx += batchSize;
        if (idx < flashes.length) {
          console.log(`Published ${idx}/${flashes.length}... waiting 30s before next batch.`);
          await new Promise((res) => setTimeout(res, 60000));
        }
      }
      console.log(`All ${flashes.length} flashes published to RabbitMQ. ${formattedCurrentTime()}`);
    } catch (error) {
      console.error("force-sync failed:", error);
    }
  }
}
