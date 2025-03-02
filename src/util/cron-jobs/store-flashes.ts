import { InvaderFlashCache } from "../cache";
import SpaceInvadersAPI from "../flash-invaders";
import MongoDBService from "../mongodb";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";

export class StoreFlashesCron extends CronTask {
  constructor(schedule: string) {
    super("store-flashes", schedule);
  }

  public async task(): Promise<void> {
    const invaderApi = new SpaceInvadersAPI();

    const flashes = await invaderApi.getFlashes();

    if (!flashes || !flashes.with_paris.length || !flashes.without_paris.length) {
      console.log(`No flashes found. ${formattedCurrentTime}`);
      return;
    }

    const flattened = [...flashes.with_paris, ...flashes.without_paris];

    const mongo = new MongoDBService("flashes");

    try {
      const uploadCount = await new InvaderFlashCache().batchUpload(
        flattened.map((flash) => ({
          imageUrl: `${invaderApi.API_URL}${flash.img}`,
          key: flash.img,
        })),
        45
      );

      await mongo.connect();

      const writtenDocuments = await mongo.writeMany(flattened);

      if (uploadCount > 0 || writtenDocuments > 0) {
        console.log(`${flattened.length} flashes. ${uploadCount} new images. ${writtenDocuments} new documents. ${formattedCurrentTime}`);
      }
    } catch (error) {
      console.error("Error storing flashes:", error);
    } finally {
      await mongo.disconnect();
    }
  }
}
