import { config } from "dotenv";
import { Collection, Db, MongoClient } from "mongodb";
import { Flash } from "../invaders/types";

config({ path: ".env" });

class MongoDBService {
  private client: MongoClient;
  private db: Db | null = null;
  private collection: Collection<Flash> | null = null;

  constructor(private dbName: string, private collectionName: string) {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined in the environment variables");
    }
    this.client = new MongoClient(mongoUri);
  }

  // Connect to the database
  public async connect(): Promise<void> {
    try {
      await this.client.connect();

      this.db = this.client.db(this.dbName);
      this.collection = this.db.collection<Flash>(this.collectionName);
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
      throw error;
    }
  }

  // Read documents from the collection
  public async readDocuments(filter: Partial<Flash> = {}): Promise<Flash[]> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }
    try {
      return await this.collection.find(filter).toArray();
    } catch (error) {
      console.error("Error reading documents:", error);
      throw error;
    }
  }

  // Write a document to the collection
  public async writeMany(flashes: Flash[]): Promise<void> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }
    try {
      const bulkOps = flashes.map((flash) => ({
        updateOne: {
          filter: { flash_id: flash.flash_id },
          update: { $setOnInsert: flash },
          upsert: true, // Insert only if the document doesn't already exist
        },
      }));

      await this.collection.bulkWrite(bulkOps, { ordered: false });
    } catch (error) {
      console.error("Error writing unique documents:", error);
      throw error;
    }
  }

  public async writeOne(flash: Flash): Promise<void> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }
    try {
      await this.collection.insertOne(flash);
    } catch (error) {
      console.error("Error writing document:", error);
      throw error;
    }
  }

  // Disconnect from the database
  public async disconnect(): Promise<void> {
    try {
      await this.client.close();
      console.log("Disconnected from MongoDB");
    } catch (error) {
      console.error("Error disconnecting from MongoDB:", error);
      throw error;
    }
  }
}

export default MongoDBService;
