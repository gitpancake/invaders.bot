import { PostgresFlashesDb } from "../database/invader-flashes";
import { FlashcastrUsersDb } from "../database/flashcastr-users";
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
      console.error("No flashes found since " + formattedCurrentTime());
      throw new Error("No flashes found since " + formattedCurrentTime());
    }

    const flattened = [...flashes.with_paris, ...flashes.without_paris];

    try {
      // Get flashcastr users to filter paris flashes
      const flashcastrUsers = await new FlashcastrUsersDb().getMany({});
      const flashcastrUsernames = new Set(flashcastrUsers.map(user => user.username.toLowerCase()));

      // Filter which flashes to write to database and publish to RabbitMQ
      const flashesToProcess = flattened.filter((flash) => {
        // Always include without_paris flashes
        if (flashes.without_paris.some(f => f.flash_id === flash.flash_id)) {
          return true;
        }

        // Only include with_paris flashes if flashed by a flashcastr user
        if (flashes.with_paris.some(f => f.flash_id === flash.flash_id)) {
          return flashcastrUsernames.has(flash.player.toLowerCase());
        }

        return false;
      });

      const writtenDocuments = await new PostgresFlashesDb().writeMany(flashesToProcess);

      // All written documents should be published to RabbitMQ
      const flashesToPublish = flashesToProcess.filter((flash) => {
        return writtenDocuments.some((doc) => Number(doc.flash_id) === flash.flash_id);
      });

      const newWithoutParisCount = flashesToPublish.filter(f => 
        flashes.without_paris.some(wp => wp.flash_id === f.flash_id)
      ).length;
      const newWithParisFromFlashcastrCount = flashesToPublish.filter(f => 
        flashes.with_paris.some(wp => wp.flash_id === f.flash_id) && 
        flashcastrUsernames.has(f.player.toLowerCase())
      ).length;
      
      console.log(`Found ${flashesToPublish.length} flashes to publish (${newWithoutParisCount} without_paris + ${newWithParisFromFlashcastrCount} with_paris from flashcastr users)`);

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
