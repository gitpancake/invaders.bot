import { config } from "dotenv";
import { FlashSyncCron } from "./util/cron-jobs/flash-sync";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";

config({ path: ".env" });

new StoreFlashesCron("*/5 * * * *").register();

new FlashSyncCron("*/15 * * * *").register();
