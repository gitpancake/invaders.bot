import { config } from "dotenv";
import { AgenticPoster } from "./util/cron-jobs/agentic-poster";
import { ChannelRefresher } from "./util/cron-jobs/refresh-bot";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";
import { FlashesDb } from "./util/mongodb/flashes";
import { PostPersonalFlash } from "./util/tasks/post-personal";

config({ path: ".env" });

// new AgenticPoster("*/10 * * * *").register();

// new StoreFlashesCron("*/5 * * * *").register();

// new ChannelRefresher("*/59 * * * *").register();

const testPersonalFlash = async () => {
  const flash = await new FlashesDb().getRandomDocument({
    player: "WORLDY",
  });

  if (!flash) {
    console.error(`No personal flashes found.`);
    return;
  }

  await new PostPersonalFlash().handle(flash);
};

testPersonalFlash()
  .then(() => {
    console.log("Test personal flash completed.");
  })
  .catch((err) => {
    console.error("Error in test personal flash:", err);
  });
