import { PostgresFlashesDb } from "../database/invader-flashes";
import { FlashcastrUsersDb } from "../database/flashcastr-users";
import SpaceInvadersAPI from "../flash-invaders";
import { RabbitImagePush } from "../rabbitmq";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";
import { DiskPersistence } from "../disk-persistence";

export class StoreFlashesCron extends CronTask {
  private diskPersistence: DiskPersistence;

  constructor(schedule: string) {
    super("store-flashes", schedule);
    this.diskPersistence = new DiskPersistence();
  }

  public async task(): Promise<void> {
    const invaderApi = new SpaceInvadersAPI();

    // First, try to retry any previously failed flashes
    const previouslyFailedFlashes = await this.diskPersistence.retryFailedFlashes();
    if (previouslyFailedFlashes.length > 0) {
      console.log(`[StoreFlashesCron] Retrying ${previouslyFailedFlashes.length} previously failed flashes...`);
      await this.processFlashes(previouslyFailedFlashes, 'retry-failed-flashes');
    }

    const flashes = await invaderApi.getFlashes();

    if (!flashes || !flashes.with_paris.length || !flashes.without_paris.length) {
      console.error("No flashes found since " + formattedCurrentTime());
      throw new Error("No flashes found since " + formattedCurrentTime());
    }

    const flattened = [...flashes.with_paris, ...flashes.without_paris];
    await this.processFlashes(flattened, 'new-flashes', flashes);
  }

  private async processFlashes(flattened: any[], context: string, originalFlashes?: any): Promise<void> {
    try {
      // Get flashcastr users to filter paris flashes
      const flashcastrUsers = await new FlashcastrUsersDb().getMany({});
      const flashcastrUsernames = new Set(flashcastrUsers.map(user => user.username.toLowerCase()));

      // Filter which flashes to write to database and publish to RabbitMQ
      const flashesToProcess = flattened.filter((flash) => {
        // For retry scenarios, we don't have original flash categories, so process all
        if (!originalFlashes) {
          return true;
        }

        // Always include without_paris flashes
        if (originalFlashes.without_paris?.some((f: any) => f.flash_id === flash.flash_id)) {
          return true;
        }

        // Only include with_paris flashes if flashed by a flashcastr user
        if (originalFlashes.with_paris?.some((f: any) => f.flash_id === flash.flash_id)) {
          return flashcastrUsernames.has(flash.player.toLowerCase());
        }

        return false;
      });

      console.log(`[StoreFlashesCron] Processing ${flashesToProcess.length} flashes (${context})`);

      // First, check which flashes already exist in DB
      const flashIds = flashesToProcess.map(f => f.flash_id);
      const existingFlashes = await this.getFlashesByIds(flashIds);
      const existingFlashIds = new Set(existingFlashes.map(f => f.flash_id));

      // Database write with error handling and persistence
      let writtenDocuments: any[] = [];
      try {
        writtenDocuments = await new PostgresFlashesDb().writeMany(flashesToProcess);
        console.log(`[StoreFlashesCron] Successfully wrote ${writtenDocuments.length} documents to database`);
      } catch (dbError) {
        console.error(`[StoreFlashesCron] Database write failed (${context}):`, dbError);
        
        // Persist failed flashes to disk for retry
        await this.diskPersistence.persistFailedFlashes(flashesToProcess, `database-write-failure-${context}: ${(dbError as Error).message}`);
        
        // Don't proceed to RabbitMQ if database write failed
        return;
      }

      // Flashes to publish: newly written + existing ones without ipfs_cid
      const newlyWrittenFlashes = flashesToProcess.filter((flash) => {
        return writtenDocuments.some((doc) => Number(doc.flash_id) === flash.flash_id);
      });

      const existingFlashesWithoutIpfs = existingFlashes.filter(flash => 
        !flash.ipfs_cid || flash.ipfs_cid.trim() === ''
      );

      const flashesToPublish = [
        ...newlyWrittenFlashes,
        ...existingFlashesWithoutIpfs
      ];

      if (flashesToPublish.length === 0) {
        console.log(`[StoreFlashesCron] No flashes to publish to RabbitMQ (${context})`);
        return;
      }

      // RabbitMQ publishing with error handling and persistence
      const rabbit = new RabbitImagePush();
      const failedPublishes: any[] = [];
      let publishCount = 0;

      for (const flash of flashesToPublish) {
        try {
          await rabbit.publish(flash);
          publishCount++;
        } catch (rabbitError) {
          console.error(`[StoreFlashesCron] Failed to publish flash ${flash.flash_id} to RabbitMQ:`, rabbitError);
          failedPublishes.push(flash);
        }
      }

      // Persist any failed RabbitMQ publishes to disk
      if (failedPublishes.length > 0) {
        await this.diskPersistence.persistFailedFlashes(failedPublishes, `rabbitmq-publish-failure-${context}`);
      }

      // Logging for successful operations
      if (originalFlashes) {
        const newWithoutParisCount = flashesToPublish.filter(f => 
          originalFlashes.without_paris?.some((wp: any) => wp.flash_id === f.flash_id)
        ).length;
        const newWithParisFromFlashcastrCount = flashesToPublish.filter(f => 
          originalFlashes.with_paris?.some((wp: any) => wp.flash_id === f.flash_id) && 
          flashcastrUsernames.has(f.player.toLowerCase())
        ).length;
        
        console.log(`[StoreFlashesCron] Found ${flashesToProcess.length} flashes to process, ${flashesToPublish.length} flashes to publish (${newlyWrittenFlashes.length} new + ${existingFlashesWithoutIpfs.length} existing without ipfs_cid) (${newWithoutParisCount} without_paris + ${newWithParisFromFlashcastrCount} with_paris from flashcastr users)`);
      }

      if (publishCount > 0 || writtenDocuments.length > 0) {
        console.log(`[StoreFlashesCron] ${flattened.length} flashes. ${publishCount} new events published. ${writtenDocuments.length} new documents. ${formattedCurrentTime()}`);
      }

      // Clear successfully processed failed flashes if this was a retry
      if (context === 'retry-failed-flashes' && publishCount > 0) {
        await this.diskPersistence.clearFailedFlashes();
      }

    } catch (error) {
      console.error(`[StoreFlashesCron] Unexpected error processing flashes (${context}):`, error);
      
      // Persist all flashes to disk if we hit an unexpected error
      await this.diskPersistence.persistFailedFlashes(flattened, `unexpected-error-${context}: ${(error as Error).message}`);
    }
  }

  private async getFlashesByIds(flashIds: number[]): Promise<any[]> {
    const flashesDb = new PostgresFlashesDb();
    return await flashesDb.getByIds(flashIds);
  }
}
