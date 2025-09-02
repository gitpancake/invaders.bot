import { config } from "dotenv";
import { FlashSyncCron } from "./util/cron-jobs/flash-sync";
import { StoreFlashesCron } from "./util/cron-jobs/store-flashes";

config({ path: ".env" });

const main = async () => {
  const flashSyncCron = new FlashSyncCron("5,15,25,35,45,55 * * * *");
  const storeFlashesCron = new StoreFlashesCron("*/10 * * * *");

  flashSyncCron.register();
  storeFlashesCron.register();

  await flashSyncCron.task();
  await storeFlashesCron.task();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
