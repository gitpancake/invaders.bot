import { PostgresFlashesDb } from "../database/invader-flashes";
import { FlashcastrUsersDb } from "../database/flashcastr-users";
import SpaceInvadersAPI from "../flash-invaders";
import { RabbitImagePush } from "../rabbitmq";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";
import { DiskPersistence } from "../disk-persistence";

export class StoreFlashesCron extends CronTask {
  private diskPersistence: DiskPersistence;
  private lastFlashCount: string | null = null;
  private consecutiveNoChanges: number = 0;

  constructor(schedule: string) {
    super("store-flashes", schedule);
    this.diskPersistence = new DiskPersistence();
  }

  public async task(): Promise<void> {
    // Smart scheduling: skip some runs during European night hours (11 PM - 6 AM CET)
    if (!this.isPeakFlashTime()) {
      // During off-peak, only run every other scheduled time (reduces frequency by 50%)
      const shouldSkip = Math.random() < 0.5;
      if (shouldSkip) {
        console.log(`[StoreFlashesCron] Skipping run during off-peak hours (European night)`);
        return;
      }
    }

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

    // Check if flash count has changed to avoid unnecessary processing
    const currentFlashCount = flashes.flash_count;
    if (this.lastFlashCount === currentFlashCount) {
      this.consecutiveNoChanges++;
      
      // Implement backoff: skip more frequently if we've seen many unchanged results
      const backoffThreshold = Math.min(this.consecutiveNoChanges, 10); // Max backoff at 10 consecutive
      const shouldSkipDueToBackoff = Math.random() < (backoffThreshold * 0.1); // 10% skip rate per consecutive no-change
      
      if (shouldSkipDueToBackoff) {
        console.log(`[StoreFlashesCron] Backoff skip (${this.consecutiveNoChanges} consecutive unchanged, count: ${currentFlashCount})`);
        return;
      }
      
      console.log(`[StoreFlashesCron] No new flashes detected (${this.consecutiveNoChanges} consecutive, count: ${currentFlashCount}) - skipping processing`);
      return;
    }

    // Reset backoff counter when we detect changes
    console.log(`[StoreFlashesCron] Flash count changed: ${this.lastFlashCount} → ${currentFlashCount} (after ${this.consecutiveNoChanges} unchanged)`);
    this.consecutiveNoChanges = 0;
    this.lastFlashCount = currentFlashCount;

    const flattened = [...flashes.with_paris, ...flashes.without_paris];
    await this.processFlashes(flattened, 'new-flashes', flashes);
  }

  private async processFlashes(flattened: any[], context: string, originalFlashes?: any): Promise<void> {
    try {
      // Get flashcastr users to filter paris flashes
      const flashcastrUsers = await new FlashcastrUsersDb().getMany({});
      const flashcastrUsernames = new Set(flashcastrUsers.map(user => user.username.toLowerCase()));

      // Filter which flashes to write to database and publish to RabbitMQ
      let flashesToProcess: any[];
      
      if (!originalFlashes) {
        // For retry scenarios, we don't have original flash categories, so process all
        flashesToProcess = flattened;
      } else {
        // Process without_paris flashes (no filtering)
        const withoutParisToProcess = originalFlashes.without_paris || [];
        
        // Process with_paris flashes (only flashcastr users)
        const withParisToProcess = (originalFlashes.with_paris || []).filter((flash: any) =>
          flashcastrUsernames.has(flash.player.toLowerCase())
        );
        
        flashesToProcess = [...withoutParisToProcess, ...withParisToProcess];
      }

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

  private isPeakFlashTime(): boolean {
    // Peak flash times: European daytime (6 AM - 11 PM CET/CEST)
    // CET is UTC+1, CEST is UTC+2. Using UTC+1 as baseline.
    const now = new Date();
    const cetHour = (now.getUTCHours() + 1) % 24;
    
    // Peak hours: 6 AM to 11 PM CET (18 hours)
    // Off-peak: 11 PM to 6 AM CET (7 hours)
    return cetHour >= 6 && cetHour < 23;
  }
}
