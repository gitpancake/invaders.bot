import { config } from "dotenv";
import { Collection, Db, MongoClient } from "mongodb";
import { Flash } from "./invaders/types";

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
  public async writeMany(flahses: Flash[]): Promise<void> {
    if (!this.collection) {
      throw new Error("Not connected to the database");
    }
    try {
      await this.collection.insertMany(flahses);
    } catch (error) {
      console.error("Error writing document:", error);
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

// // Example usage:
// (async () => {
//   const mongoService = new MongoDBService("invader-flashes", "flashes");
//   try {
//     await mongoService.connect();

//     // Write a document
//     const newFlash: Flash = {
//       img: "https://example.com/image.jpg",
//       city: "New York",
//       text: "A bright flash in the sky!",
//       player: "Player123",
//       flash_id: 1,
//       timestamp: Date.now(),
//       flash_count: "1",
//     };
//     await mongoService.writeDocument(newFlash);

//     // Read documents
//     const documents = await mongoService.readDocuments({ city: "New York" });
//     console.log("Documents:", documents);
//   } catch (error) {
//     console.error("Error:", error);
//   } finally {
//     await mongoService.disconnect();
//   }
// })();
