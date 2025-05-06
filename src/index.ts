import { config } from "dotenv";
import { FlashSyncCron } from "./util/cron-jobs/flash-sync";

config({ path: ".env" });

// new AgenticPoster("*/10 * * * *").register();

// new StoreFlashesCron("*/5 * * * *").register();

// new ChannelRefresher("*/59 * * * *").register();

new FlashSyncCron("*/5 * * * *").task();
