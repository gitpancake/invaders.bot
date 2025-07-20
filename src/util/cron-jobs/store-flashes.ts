import { PostgresFlashesDb } from "../database/invader-flashes";
import SpaceInvadersAPI from "../flash-invaders";
import { RabbitImagePush } from "../rabbitmq";
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
      throw new Error("No flashes found since " + formattedCurrentTime());
    }

    const flattened = [...flashes.with_paris, ...flashes.without_paris];

    try {
      const writtenDocuments = await new PostgresFlashesDb().writeMany(flattened);

      const flashesToPublish = flattened.filter((flash) => {
        return writtenDocuments.some((doc) => Number(doc.flash_id) === flash.flash_id);
      });

      const rabbit = new RabbitImagePush();
      let publishCount = 0;
      for (const flash of flashesToPublish) {
        await rabbit.publish(flash);
        publishCount++;
      }

      if (publishCount > 0 || writtenDocuments.length > 0) {
        console.log(`${flattened.length} flashes. ${publishCount} new events published. ${writtenDocuments.length} new documents. ${formattedCurrentTime()}`);
      }
    } catch (error) {
      console.error("Error storing flashes:", error);
    }
  }
}
