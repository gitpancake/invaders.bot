import { config } from "dotenv";
import { FlashSyncCron } from "./util/cron-jobs/flash-sync";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";

config({ path: ".env" });

const storeFlashesCron = new StoreFlashesCron("*/7 * * * *");
storeFlashesCron.task();
storeFlashesCron.register();

const flashSyncCron = new FlashSyncCron("*/15 * * * *");
flashSyncCron.task();
flashSyncCron.register();
