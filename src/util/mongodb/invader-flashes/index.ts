import { Filter, MongoBulkWriteError } from "mongodb";
import { Mongo } from "../connector";
import { Flash } from "./types";

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

  public async getMany(filter: Filter<Flash>): Promise<Flash[]> {
    return this.execute(async (collection) => await collection.find(filter).toArray());
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
}
