import { config } from "dotenv";
import { AgenticPoster } from "./util/cron-jobs/agentic-poster";
import { ChannelRefresher } from "./util/cron-jobs/refresh-bot";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";

config({ path: ".env" });

new AgenticPoster("*/10 * * * *").register();

new StoreFlashesCron("*/5 * * * *").register();

new ChannelRefresher("*/59 * * * *").register();
