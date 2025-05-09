import { Collection, Db, Document, MongoClient } from "mongodb";

let mongoClient: MongoClient | null = null;
const collectionCache: Map<string, Collection<any>> = new Map();

export abstract class Mongo<T extends Document> {
  protected db!: Db;
  protected collection!: Collection<T>;

  constructor(private options: { dbName: string; collectionName: string }) {}

  protected async onConnect(): Promise<void> {}

  private async getClient(): Promise<MongoClient> {
    const uri = process.env.DATABASE_URL!;
    if (!mongoClient) {
      mongoClient = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      await mongoClient.connect();
    } else {
      try {
        await mongoClient.db("admin").command({ ping: 1 });
      } catch (err) {
        console.warn("Reconnecting to Mongo...");
        mongoClient = new MongoClient(uri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
        });
        await mongoClient.connect();
      }
    }
    return mongoClient;
  }

  public async connect(): Promise<void> {
    const cacheKey = `${this.options.dbName}.${this.options.collectionName}`;

    // ✅ Reuse cached collection if available

    const client = await this.getClient();
    this.db = client.db(this.options.dbName);

    // ✅ Reuse cached collection if available
    const cachedCollection = collectionCache.get(cacheKey);
    if (cachedCollection) {
      this.collection = cachedCollection as Collection<T>;
      return;
    }

    console.log(`Connecting to ${cacheKey}`);

    this.collection = this.db.collection<T>(this.options.collectionName);
    await this.onConnect();
    collectionCache.set(cacheKey, this.collection);
  }

  protected async execute<R>(fn: (col: Collection<T>) => Promise<R>): Promise<R> {
    if (!this.collection) {
      await this.connect();
    }
    return fn(this.collection);
  }
}
