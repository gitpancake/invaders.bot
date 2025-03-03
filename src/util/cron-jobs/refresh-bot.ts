import { InvadersFunHandler } from "../invaders.fun";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";

export class ChannelRefresher extends CronTask {
  constructor(schedule: string) {
    super("channel-refresher", schedule);
  }

  public async task(): Promise<void> {
    try {
      console.log(`Refreshing channel casts. ${formattedCurrentTime()}`);
      await new InvadersFunHandler().refreshCache();
    } catch (error) {}
  }
}
