import { Mongo } from "../connector";
import { User } from "./types";

export class FlashcastrUsersDb extends Mongo<User> {
  constructor() {
    super({
      dbName: "flashcastr",
      collectionName: "users",
    });
  }

  public async onConnect(): Promise<void> {
    await this.collection.createIndex({ fid: -1 });
  }

  public async getMany(filter: Partial<User>): Promise<User[]> {
    return this.execute(async (collection) => await collection.find(filter).toArray());
  }
}
