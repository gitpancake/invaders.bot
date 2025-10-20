import { config } from "dotenv";
import { FlashcastrFlashesDb } from "../util/database/flashcastr-flashes";
import { FlashcastrUsersDb } from "../util/database/flashcastr-users";
import { PostgresFlashesDb } from "../util/database/invader-flashes";
import { NeynarUsers } from "../util/neynar/users";
import { decrypt } from "../util/encrypt";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

config({ path: ".env" });

interface BrokenCast {
  flash_id: number;
  cast_hash: string;
  user_fid: number;
  user_username: string;
  signer_uuid: string;
  city: string;
  ipfs_cid: string;
}

class CastChecker {
  private neynarClient: NeynarAPIClient;
  private flashcastrFlashesDb: FlashcastrFlashesDb;
  private flashcastrUsersDb: FlashcastrUsersDb;
  private flashesDb: PostgresFlashesDb;
  private neynarUsers: NeynarUsers;

  constructor() {
    if (!process.env.NEYNAR_API_KEY) {
      throw new Error("NEYNAR_API_KEY is not defined");
    }

    this.neynarClient = new NeynarAPIClient({
      apiKey: process.env.NEYNAR_API_KEY,
    });

    this.flashcastrFlashesDb = new FlashcastrFlashesDb();
    this.flashcastrUsersDb = new FlashcastrUsersDb();
    this.flashesDb = new PostgresFlashesDb();
    this.neynarUsers = new NeynarUsers();
  }

  /**
   * Check if a cast exists by its hash
   */
  private async castExists(castHash: string): Promise<boolean> {
    try {
      await this.neynarClient.lookupCastByHashOrWarpcastUrl({
        identifier: castHash,
        type: "hash",
      });
      return true;
    } catch (error: any) {
      // If cast not found, Neynar throws an error
      if (error.message?.includes("not found") || error.response?.status === 404) {
        return false;
      }
      // For other errors (rate limits, network issues), log and treat as existing to be safe
      console.error(`Error checking cast ${castHash}:`, error.message);
      return true; // Assume exists to avoid unnecessary recasts
    }
  }

  /**
   * Get all casts with hashes from the database
   */
  private async getAllCastsWithHashes(): Promise<any[]> {
    return await this.flashcastrFlashesDb.getAllCastsWithHashes();
  }

  /**
   * Recast a flash that has a broken cast hash
   */
  private async recastFlash(brokenCast: BrokenCast): Promise<boolean> {
    try {
      const decryptionKey = process.env.SIGNER_ENCRYPTION_KEY;

      if (!decryptionKey) {
        throw new Error("SIGNER_ENCRYPTION_KEY is not defined");
      }

      console.log(`  ↻ Recasting flash ${brokenCast.flash_id} for @${brokenCast.user_username}...`);

      const newCastHash = await this.neynarUsers.publishCast({
        signerUuid: decrypt(brokenCast.signer_uuid, decryptionKey),
        msg: `I just flashed an Invader in ${brokenCast.city}! 👾`,
        embeds: [{ url: `https://www.flashcastr.app/flash/${brokenCast.flash_id}` }],
        channelId: "invaders",
      });

      // Update the cast hash in database
      await this.flashcastrFlashesDb.updateCastHash(brokenCast.flash_id, newCastHash);

      console.log(`  ✅ Successfully recast! New hash: ${newCastHash}`);
      return true;
    } catch (error: any) {
      console.error(`  ❌ Failed to recast flash ${brokenCast.flash_id}:`, error.message);
      return false;
    }
  }

  /**
   * Main function to check all casts and repair broken ones
   */
  public async run(): Promise<void> {
    console.log("🔍 Starting cast verification...\n");

    try {
      // Get all casts with hashes
      const casts = await this.getAllCastsWithHashes();
      console.log(`Found ${casts.length} casts to verify\n`);

      if (casts.length === 0) {
        console.log("No casts to verify. Exiting.");
        return;
      }

      const brokenCasts: BrokenCast[] = [];
      let checkedCount = 0;
      let existsCount = 0;
      let brokenCount = 0;

      // Check each cast
      console.log("Checking casts...");
      for (const cast of casts) {
        checkedCount++;
        process.stdout.write(`\rProgress: ${checkedCount}/${casts.length} checked...`);

        const exists = await this.castExists(cast.cast_hash);

        if (exists) {
          existsCount++;
        } else {
          brokenCount++;
          brokenCasts.push({
            flash_id: cast.flash_id,
            cast_hash: cast.cast_hash,
            user_fid: cast.user_fid,
            user_username: cast.user_username,
            signer_uuid: cast.signer_uuid,
            city: cast.city,
            ipfs_cid: cast.ipfs_cid,
          });
        }

        // Rate limit: small delay between checks
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log("\n");
      console.log("=" .repeat(60));
      console.log("📊 Verification Summary:");
      console.log("=" .repeat(60));
      console.log(`Total casts checked: ${checkedCount}`);
      console.log(`✅ Valid casts: ${existsCount}`);
      console.log(`❌ Broken casts: ${brokenCount}`);
      console.log("=" .repeat(60));

      if (brokenCasts.length === 0) {
        console.log("\n✨ All casts are valid! No repairs needed.");
        return;
      }

      // Display broken casts
      console.log(`\n🔧 Found ${brokenCasts.length} broken cast(s):\n`);
      brokenCasts.forEach((cast, index) => {
        console.log(`${index + 1}. Flash ${cast.flash_id} (@${cast.user_username})`);
        console.log(`   Hash: ${cast.cast_hash}`);
        console.log(`   City: ${cast.city}\n`);
      });

      // Ask for confirmation
      console.log("🔧 Starting recast process...\n");

      let successCount = 0;
      let failCount = 0;

      for (const brokenCast of brokenCasts) {
        const success = await this.recastFlash(brokenCast);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }

        // Rate limit: delay between recasts
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      console.log("\n" + "=" .repeat(60));
      console.log("📊 Recast Summary:");
      console.log("=" .repeat(60));
      console.log(`✅ Successfully recast: ${successCount}`);
      console.log(`❌ Failed to recast: ${failCount}`);
      console.log("=" .repeat(60));

      if (successCount > 0) {
        console.log("\n✨ Broken casts have been repaired!");
      }
    } catch (error) {
      console.error("\n❌ Error during cast verification:", error);
      throw error;
    }
  }
}

// Run the script
const checker = new CastChecker();
checker
  .run()
  .then(() => {
    console.log("\n✅ Cast check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Cast check failed:", error);
    process.exit(1);
  });
