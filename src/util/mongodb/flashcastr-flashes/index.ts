import { Filter, MongoBulkWriteError } from "mongodb";
import { Mongo } from "../connector";
import { Flashcastr } from "./types";

export class FlashcastrFlashesDb extends Mongo<Flashcastr> {
  constructor() {
    super({
      dbName: "flashcastr",
      collectionName: "flashes",
    });
  }

  public async onConnect(): Promise<void> {
    await this.collection.createIndex({ "user.fid": 1 }, { name: "idx_user_fid" });
    await this.collection.createIndex({ "user.username": 1 }, { name: "idx_user_username" });

    await this.collection.createIndex({ "flash.city": 1 }, { name: "idx_flash_city" });
    await this.collection.createIndex({ "flash.player": 1 }, { name: "idx_flash_player" });

    await this.collection.createIndex({ "flash.timestamp": -1 }, { name: "idx_flash_timestamp_desc" });

    await this.collection.createIndex({ "flash.city": "text", "flash.player": "text" }, { name: "text_search_city_player" });
  }

  public async getMany(query: Filter<Flashcastr>): Promise<Flashcastr[]> {
    return this.execute(async (collection) => {
      return collection.find(query).toArray();
    });
  }

  public async insertMany(flashes: Flashcastr[]): Promise<number> {
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
}
