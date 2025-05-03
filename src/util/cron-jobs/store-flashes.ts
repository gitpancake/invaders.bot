import { InvaderFlashCache } from "../cache";
import SpaceInvadersAPI from "../flash-invaders";
import { FlashesDb } from "../mongodb/flashes";
import { PostPersonalFlash } from "../tasks/post-personal";
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
      console.log(`No flashes found. ${formattedCurrentTime()}`);
      return;
    }

    const flattened = [...flashes.with_paris, ...flashes.without_paris];

    try {
      const uploadCount = await new InvaderFlashCache().batchUpload(
        flattened.map((flash) => ({
          imageUrl: `${invaderApi.API_URL}${flash.img}`,
          key: flash.img,
        })),
        45
      );

      const writtenDocuments = await new FlashesDb().writeMany(flattened);

      const personalFlashes = flattened.filter((flash) => flash.player === "WORLDY");

      for (const flash of personalFlashes) {
        await new PostPersonalFlash().handle(flash);
      }

      if (uploadCount > 0 || writtenDocuments > 0) {
        console.log(`${flattened.length} flashes. ${uploadCount} new images. ${writtenDocuments} new documents. ${formattedCurrentTime()}`);
      }
    } catch (error) {
      console.error("Error storing flashes:", error);
    }
  }
}
