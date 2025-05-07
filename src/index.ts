import { config } from "dotenv";
import { FlashSyncCron } from "./util/cron-jobs/flash-sync";
import { ChannelRefresher } from "./util/cron-jobs/refresh-bot";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";

config({ path: ".env" });

new StoreFlashesCron("*/5 * * * *").register();

new ChannelRefresher("*/59 * * * *").register();

new FlashSyncCron("*/5 * * * *").register();
