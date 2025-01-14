import { config } from "dotenv";
import cron from "node-cron";
import Coordinator from "./util/coordinator";

config({ path: ".env" });

cron.schedule("* * * * *", async () => {
  await new Coordinator().fetchFlashes(["Los Angeles", "New York", "Miami", "San Diego"]).catch((err) => {
    console.log(err);
  });
});

cron.schedule("*/5 * * * *", async () => {
  await new Coordinator().fetchFlashes().catch((err) => {
    console.log(err);
  });
});
