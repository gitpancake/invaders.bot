import axios from "axios";
import { uploadImagesInBatches } from "../images/uploader";
import SpaceInvaders from "../invaders";
import { Flash } from "../invaders/types";
import MongoDBService from "../mongodb";

class Coordinator {
  private invaders: SpaceInvaders;
  private mongo: MongoDBService;

  constructor() {
    const collectionName = "flashes";
    this.invaders = new SpaceInvaders();
    this.mongo = new MongoDBService(collectionName);
  }

  private async postFlash(flash: Flash): Promise<void> {
    try {
      await axios.post(`${process.env.API_URL}/api/bot`, {
        secret: process.env.WEBHOOK_SECRET,
        flash: { ...flash, img: `${process.env.S3_URL}${flash.img}` },
      });
    } catch (error) {
      console.error(`Error posting flash ${flash.flash_id}:`, error);
      throw error;
    }
  }

  private async uploadFlashImages(flashes: Flash[]): Promise<void> {
    const imageUploadRequests = flashes.map((flash) => ({
      imageUrl: `${this.invaders.IMAGE_BASE}${flash.img}`,
      key: flash.img,
    }));

    try {
      await uploadImagesInBatches(imageUploadRequests, 45);
    } catch (error) {
      console.error("Error occurred while uploading images:", error);
      throw error;
    }
  }

  private async updateFlashAsPosted(flashId: number): Promise<void> {
    try {
      await this.mongo.updateDocument({ flash_id: flashId }, { posted: true });
    } catch (error) {
      console.error(`Error updating flash ${flashId} as posted:`, error);
    }
  }

  private async processAndPostFlashes(flashes: Flash[], cities?: string[]): Promise<void> {
    // Fetch existing flashes from the database
    const existingFlashes = await this.mongo.getMultipleByFlashId(flashes.map((flash) => flash.flash_id));

    // Filter flashes that haven't been posted yet
    const unpostedFlashes = flashes.filter((flash) => {
      const existing = existingFlashes.find((p) => p.flash_id === flash.flash_id);
      return existing && !existing.posted;
    });

    if (!unpostedFlashes.length) {
      console.log("No unposted flashes found.");
      return;
    }

    if (cities) {
      // Post city-specific flashes
      await Promise.all(
        unpostedFlashes.map(async (flash) => {
          await this.postFlash(flash);
          await this.updateFlashAsPosted(flash.flash_id);
          console.log(`City-specific flash posted: ${flash.city}`);
        })
      );
    } else {
      // Post a random flash
      const randomFlash = unpostedFlashes[Math.floor(Math.random() * unpostedFlashes.length)];
      await this.postFlash(randomFlash);
      await this.updateFlashAsPosted(randomFlash.flash_id);
      console.log(`Random flash posted: ${randomFlash.city}`);
    }
  }

  public async fetchFlashes(cities?: string[]): Promise<void> {
    const latestFlashes = await this.invaders.getLatestFlashes();

    if (!latestFlashes) {
      console.log("No response from flashes API");
      return;
    }

    const flashes = [...latestFlashes.without_paris, ...latestFlashes.with_paris].filter((flash) => (cities ? cities.includes(flash.city) : true));

    if (!flashes.length) {
      console.log(`No recent flashes found${cities ? " in cities: " + cities.join(", ") : ""}`);
      return;
    }

    try {
      // Upload images
      await this.uploadFlashImages(flashes);

      // Connect to the database
      await this.mongo.connect();

      // Insert flashes into the database
      await this.mongo.writeMany(flashes);

      // Process and post flashes
      await this.processAndPostFlashes(flashes, cities);
    } catch (error) {
      console.error("Error during fetchFlashes execution:", error);
    } finally {
      await this.mongo.disconnect();
    }
  }
}

export default Coordinator;
