import { config } from "dotenv";
import { Collection, Db, Filter, FindOptions, MongoBulkWriteError, MongoClient } from "mongodb";
import { Flash } from "../flash-invaders/types";

config({ path: ".env" });

class MongoDBService {
  private client: MongoClient;
  private db: Db | null = null;
  private collection: Collection<Flash> | null = null;
  private dbName: string = "invaders";
  private collectionName: string;

  constructor(collectionName: string) {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined in the environment variables");
    }

    this.client = new MongoClient(mongoUri);
    this.collectionName = collectionName;
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

  public async disconnect(): Promise<void> {
    try {
      await this.client.close();
    } catch (error) {
      console.error("Error disconnecting from MongoDB:", error);
      throw error;
    }
  }

  public async getRandomDocument(query: Filter<Flash> = {}, options: FindOptions = {}): Promise<Flash | null> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }

    try {
      const count = await this.collection.countDocuments(query);

      if (count === 0) {
        throw new Error("No documents found.");
      }

      const randomIndex = Math.floor(Math.random() * count);

      const document = await this.collection.find(query, options).skip(randomIndex).limit(1).next();

      return document;
    } catch (error) {
      console.error("Error retrieving a random document:", error);
      throw error;
    }
  }

  // Write a document to the collection
  public async writeMany(flashes: Flash[]): Promise<number> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }

    try {
      const result = await this.collection.insertMany(flashes, { ordered: false });

      return result.insertedCount;
    } catch (error: unknown) {
      if (error instanceof MongoBulkWriteError) {
        if (error.code !== 11000) {
          console.error("Error writing documents:", error);
        }

        return error.result.insertedCount;
      }

      return 0;
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
      // console.log("Document updated successfully");
    } catch (error) {
      console.error("Error updating document:", error);
      throw error;
    }
  }
}

export default MongoDBService;
