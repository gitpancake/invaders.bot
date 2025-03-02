import cron from "node-cron";
import { InvadersFunHandler } from "../invaders.fun";
import { CronTask } from "./base";

export class ChannelRefresher extends CronTask {
  constructor(schedule: string) {
    super("channel-refresher", schedule);
  }

  public async task(): Promise<void> {
    try {
      await new InvadersFunHandler().refreshCache();
    } catch (error) {}
  }

  public register(): void {
    console.log(`Registering ${this.name} cron job`);

    cron.schedule(this.schedule, async () => {
      await this.task();
    });
  }
}
