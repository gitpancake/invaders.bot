import { format } from "date-fns";
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

    if (flattened.length === 0) {
      console.log("No flashes found.");
      return;
    }

    const prepared: InvaderFlash[] = flattened.map((flash) => ({
      imageUrl: `${invaderApi.API_URL}${flash.img}`,
      key: flash.img,
    }));

    const mongo = new MongoDBService("flashes");

    try {
      const uploadCount = await new InvaderFlashCache().batchUpload(prepared, 45);

      await mongo.connect();

      const writtenDocuments = await mongo.writeMany(flattened);

      if (uploadCount > 0 || writtenDocuments > 0) {
        console.log(`${flattened.length} flashes. ${uploadCount} new images. ${writtenDocuments} new documents. ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`);
      }
    } catch (error) {
      console.error("Error storing flashes:", error);
    } finally {
      await mongo.disconnect();
    }
  }
}
