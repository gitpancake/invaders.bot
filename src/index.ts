import { config } from "dotenv";
import cron from "node-cron";
import Coordinator from "./util/coordinator";

config({ path: ".env" });

console.log("running");
cron.schedule("* * * * *", async () => {
  console.log("running");
  await new Coordinator().fetchFlashes(["Los Angeles", "New York", "Miami", "San Diego"]).catch((err) => {
    console.log(err);
  });
});

cron.schedule("*/5 * * * *", async () => {
  await new Coordinator().fetchFlashes().catch((err) => {
    console.log(err);
  });
});
