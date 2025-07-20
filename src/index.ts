import { config } from "dotenv";
import { FlashSyncCron } from "./util/cron-jobs/flash-sync";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";

config({ path: ".env" });

const main = async () => {
  const storeFlashesCron = new StoreFlashesCron("*/1 * * * *");
  storeFlashesCron.task();
  storeFlashesCron.register();

  const flashSyncCron = new FlashSyncCron("*/5 * * * *");
  flashSyncCron.task();
  flashSyncCron.register();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
