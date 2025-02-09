import { config } from "dotenv";
import cron from "node-cron";
import Coordinator from "./util/coordinator";

config({ path: ".env" });

cron.schedule("*/5 * * * *", async () => {
  await new Coordinator().fetchFlashes(["Los Angeles", "New York", "Miami", "San Diego"]).catch((err) => {
    console.error(err);
  });
});

cron.schedule("*/15 * * * *", async () => {
  await new Coordinator().fetchFlashes().catch((err) => {
    console.error(err);
  });
});
