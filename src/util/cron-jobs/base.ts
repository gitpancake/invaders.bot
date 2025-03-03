import cron from "node-cron";

export abstract class CronTask {
  public name: string;
  public schedule: string;
  private job: cron.ScheduledTask;

  constructor(_name: string, _schedule: string) {
    this.name = _name;
    this.schedule = _schedule;

    this.job = cron.schedule(
      this.schedule,
      async () => {
        await this.task();
      },
      {
        scheduled: false,
      }
    );
  }

  public abstract task(): Promise<void>;

  public register(): void {
    this.onRegister();
  }

  protected onRegister(): void {
    if (!this.schedule || !cron.validate(this.schedule)) {
      console.error(`No schedule found for cron task: ${this.name}`);
      return;
    }

    console.log(`Registering cron task: ${this.name} with schedule: ${this.schedule}`);

    this.job.start();
  }
}
