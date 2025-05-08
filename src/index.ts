import { config } from "dotenv";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";

config({ path: ".env" });

new StoreFlashesCron("*/5 * * * *").task();

// new ChannelRefresher("*/59 * * * *").register();

// new FlashSyncCron("*/1 * * * *").register();
