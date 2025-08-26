import { config } from "dotenv";
import { FlashSyncCron } from "./util/cron-jobs/flash-sync";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";

config({ path: ".env" });

const main = async () => {
  const flashSyncCron = new FlashSyncCron("*/5 * * * *");
  const storeFlashesCron = new StoreFlashesCron("*/15 * * * *");

  flashSyncCron.register();
  storeFlashesCron.register();

  await flashSyncCron.task();
  await storeFlashesCron.task();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
