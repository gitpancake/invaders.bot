import SpaceInvadersAPI from "../flash-invaders";
import { InvaderFlashCache } from "../image-sync";
import { FlashesDb } from "../mongodb/invader-flashes";
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
      const writtenDocuments = await new FlashesDb().writeMany(flattened);

      const uploadCount = await new InvaderFlashCache().batchUpload(
        flattened
          .filter((flash) => {
            return writtenDocuments.some((doc) => doc.flash_id === flash.flash_id);
          })
          .map((flash) => ({
            imageUrl: `${invaderApi.API_URL}${flash.img}`,
            key: flash.img,
          }))
      );

      if (uploadCount > 0 || writtenDocuments.length > 0) {
        console.log(`${flattened.length} flashes. ${uploadCount} new images. ${writtenDocuments.length} new documents. ${formattedCurrentTime()}`);
      }
    } catch (error) {
      console.error("Error storing flashes:", error);
    }
  }
}
