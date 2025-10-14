import { StoreFlashesCron } from "./store-flashes";
import { FlashSyncCron } from "./flash-sync";
import { CronTask } from "./base";

export class CombinedSyncCron extends CronTask {
  constructor(schedule: string) {
    super("combined-sync", schedule);
  }

  public async task(): Promise<void> {
    try {
      // Step 1: Store flashes from the API
      console.log("[CombinedSyncCron] Starting StoreFlashesCron...");
      await StoreFlashesCron.executeTask();
      console.log("[CombinedSyncCron] StoreFlashesCron completed");

      // Step 2: Wait 3 minutes for image processing service to download and pin images
      console.log("[CombinedSyncCron] Waiting 3 minutes for image processing...");
      await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000)); // 3 minutes in milliseconds
      console.log("[CombinedSyncCron] Wait complete");

      // Step 3: Sync flashes for Flashcastr users (now with IPFS hashes populated)
      console.log("[CombinedSyncCron] Starting FlashSyncCron...");
      await FlashSyncCron.executeTask();
      console.log("[CombinedSyncCron] FlashSyncCron completed");
    } catch (error) {
      console.error("[CombinedSyncCron] Error in combined sync:", error);
      throw error;
    }
  }
}
