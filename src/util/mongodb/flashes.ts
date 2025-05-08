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
    if (!this.collection) {
      throw new Error("Collection is not initialized");
    }

    await this.collection.createIndex({ flash_id: 1 }, { unique: true });
  }

  public async getDocument(filter: Partial<Flash>): Promise<Flash | null> {
    return this.execute(async (collection) => {
      const result = await collection.findOne(filter);
      return result || null;
    });
  }

  public async getRandomDocument(query: Filter<Flash> = {}): Promise<Flash | null> {
    return this.execute(async (collection) => {
      const result = await collection.aggregate<Flash>([{ $match: query }, { $sample: { size: 1 } }]).toArray();
      return result[0] || null;
    });
  }

  public async getMany(filter: Filter<Flash>): Promise<Flash[]> {
    return this.execute(async (collection) => await collection.find(filter).toArray());
  }

  public async getRecentFlashes(limit: number): Promise<Flash[]> {
    return this.execute(async (collection) => {
      return await collection.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
    });
  }

  public async writeMany(flashes: Flash[]): Promise<Flash[]> {
    return this.execute(async (collection) => {
      try {
        const result = await collection.insertMany(flashes, { ordered: false });
        return flashes.filter((_, index) => result.insertedIds[index] !== undefined);
      } catch (error: unknown) {
        if (error instanceof MongoBulkWriteError) {
          if (error.code !== 11000) {
            console.error("Error writing documents:", error);
          }
          // Return only the successfully inserted documents
          return flashes.filter((_, index) => error.result.insertedIds[index] !== undefined);
        }
        return [];
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
