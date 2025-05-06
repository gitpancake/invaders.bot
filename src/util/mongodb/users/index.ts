import { Collection, UpdateFilter } from "mongodb";
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

  public async get(filter: Partial<User>): Promise<User | null> {
    return this.execute(async (collection) => await collection.findOne(filter));
  }

  public async getMany(filter: Partial<User>): Promise<User[]> {
    return this.execute(async (collection) => await collection.find(filter).toArray());
  }

  public async insert(user: User): Promise<string> {
    return this.execute(async (collection) => {
      const result = await collection.insertOne(user);

      if (result.acknowledged) {
        return result.insertedId.toString();
      }

      throw new Error("Failed to insert user");
    });
  }

  public async updateDocument(filter: Partial<User>, update: UpdateFilter<User>): Promise<void> {
    return this.execute(async (collection: Collection<User>) => {
      const result = await collection.updateOne(filter, update);
      if (result.matchedCount === 0) {
        throw new Error("No document found matching the filter criteria");
      }
    });
  }

  public async deleteDocument(filter: Partial<User>): Promise<void> {
    return this.execute(async (collection: Collection<User>) => {
      const result = await collection.deleteOne(filter);
      if (result.deletedCount === 0) {
        throw new Error("No document found matching the filter criteria");
      }
    });
  }
}
