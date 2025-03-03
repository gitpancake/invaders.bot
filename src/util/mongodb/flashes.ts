import { Filter, MongoBulkWriteError } from "mongodb";
import { Flash } from "../flash-invaders/types";
import { Mongo } from "./connector";

export class FlashesDb extends Mongo<Flash> {
  constructor() {
    super({
      dbName: "invaders",
      collectionName: "flashes",
    });
  }

  public async onConnect(): Promise<void> {
    await this.execute(async (collection) => {
      await collection.createIndex({ flash_id: 1 }, { unique: true });
    });
  }

  public async getRandomDocument(query: Filter<Flash> = {}): Promise<Flash | null> {
    return this.execute(async (collection) => {
      const result = await collection.aggregate<Flash>([{ $match: query }, { $sample: { size: 1 } }]).toArray();
      return result[0] || null;
    });
  }

  public async writeMany(flashes: Flash[]): Promise<number> {
    return this.execute(async (collection) => {
      try {
        const result = await collection.insertMany(flashes, { ordered: false });
        return result.insertedCount;
      } catch (error: unknown) {
        if (error instanceof MongoBulkWriteError) {
          if (error.code !== 11000) {
            console.error("Error writing documents:", error);
          }
          return error.result.insertedCount ?? 0;
        }
        return 0;
      }
    });
  }

  public async updateDocument(filter: Partial<Flash>, update: Partial<Flash>): Promise<void> {
    return this.execute(async (collection) => {
      const result = await collection.updateOne(filter, { $set: update });
      if (result.matchedCount === 0) {
        throw new Error("No document found matching the filter criteria");
      }
    });
  }
}
