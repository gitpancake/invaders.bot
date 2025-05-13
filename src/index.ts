import { config } from "dotenv";
import { FlashSyncCron } from "./util/cron-jobs/flash-sync";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";

config({ path: ".env" });

// const storeFlashesCron = new StoreFlashesCron("*/5 * * * *");
// storeFlashesCron.task();
// storeFlashesCron.register();

// const flashSyncCron = new FlashSyncCron("*/5 * * * *");
// flashSyncCron.task();
// flashSyncCron.register();
