export abstract class CronTask {
  public name: string;
  public schedule: string;

  constructor(_name: string, _schedule: string) {
    this.name = _name;
    this.schedule = _schedule;
  }

  public abstract task(): Promise<void>;
  public abstract register(): void;
}
