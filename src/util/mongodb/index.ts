import { config } from "dotenv";
import { Collection, Db, MongoClient } from "mongodb";
import { Flash } from "../invaders/types";

config({ path: ".env" });

class MongoDBService {
  private client: MongoClient;
  private db: Db | null = null;
  private collection: Collection<Flash> | null = null;
  private dbName: string = "invaders";

  constructor(private collectionName: string) {
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

      await this.collection.createIndex({ flash_id: 1 }, { unique: true });
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

  public async getRandomDocument(filter: Partial<Flash> = {}): Promise<Flash> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }
    try {
      const count = await this.collection.countDocuments(filter);
      const randomIndex = Math.floor(Math.random() * count);
      const flash = await this.collection.find(filter).limit(1).skip(randomIndex).next();

      if (!flash) {
        return await this.getRandomDocument(filter);
      }

      return flash;
    } catch (error) {
      console.error("Error reading documents:", error);
      throw error;
    }
  }

  public async getMultipleByFlashId(flashIds: number[]): Promise<Flash[]> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }
    try {
      return await this.collection.find<Flash>({ flash_id: { $in: flashIds } }).toArray();
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
      // Use `ordered: false` to continue inserting other documents even if some fail due to duplication
      await this.collection.insertMany(flashes, { ordered: false });
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key error (MongoDB error code for unique constraint violation)
        console.warn("Some flashes were not inserted due to duplicate flash_id values.");
      } else {
        console.error("Error writing documents:", error);
        throw error;
      }
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

  public async updateDocument(filter: Partial<Flash>, update: Partial<Flash>): Promise<void> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }
    try {
      const result = await this.collection.updateOne(filter, { $set: update });
      if (result.matchedCount === 0) {
        throw new Error("No document found matching the filter criteria");
      }
      console.log("Document updated successfully");
    } catch (error) {
      console.error("Error updating document:", error);
      throw error;
    }
  }

  public async updateManyDocuments(filter: Partial<Flash>, update: Partial<Flash>): Promise<void> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }
    try {
      const result = await this.collection.updateMany(filter, { $set: update });
      if (result.matchedCount === 0) {
        throw new Error("No documents found matching the filter criteria");
      }
      console.log("Documents updated successfully");
    } catch (error) {
      console.error("Error updating documents:", error);
      throw error;
    }
  }
}

export default MongoDBService;
