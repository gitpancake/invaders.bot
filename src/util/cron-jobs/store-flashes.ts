import cron from "node-cron";
import { InvaderFlash, InvaderFlashCache } from "../cache";
import SpaceInvadersAPI from "../flash-invaders";
import MongoDBService from "../mongodb";
import { CronTask } from "./base";

export class StoreFlashesCron extends CronTask {
  constructor(schedule: string) {
    super("store-flashes", schedule);
  }

  public async task(): Promise<void> {
    const invaderApi = new SpaceInvadersAPI();

    const flashes = await invaderApi.getFlashes();

    if (!flashes) {
      console.log("No flashes found.");
      return;
    }

    const flattened = [...flashes.with_paris, ...flashes.without_paris];

    const prepared: InvaderFlash[] = flattened.map((flash) => ({
      imageUrl: `${invaderApi.API_URL}${flash.img}`,
      key: flash.img,
    }));

    const mongo = new MongoDBService("flashes");

    try {
      console.log(`Preparing to store ${flattened.length} flashes`);

      const uploadCount = await new InvaderFlashCache().batchUpload(prepared, 45);

      console.log(`Uploaded ${uploadCount} new images`);

      await mongo.connect();

      const writtenDocuments = await mongo.writeMany(flattened);

      console.log(`Wrote ${writtenDocuments} new documents`);
    } catch (error) {
      console.error("Error storing flashes:", error);
    } finally {
      await mongo.disconnect();
    }
  }

  public register(): void {
    console.log(`Registering ${this.name} cron job`);

    cron.schedule(this.schedule, async () => {
      await this.task();
    });
  }
}
