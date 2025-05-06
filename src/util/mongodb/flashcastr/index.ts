import { MongoBulkWriteError } from "mongodb";
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
    await this.collection.createIndex({ "user.fid": -1 });
    await this.collection.createIndex({ "flash.flash_id": 1 }, { unique: true });
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
