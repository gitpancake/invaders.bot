import { config } from "dotenv";
import { FlashcastrFlashesDb } from "../util/database/flashcastr-flashes";
import { NeynarUsers } from "../util/neynar/users";
import { decrypt } from "../util/encrypt";

config({ path: ".env" });

interface NullCast {
  flash_id: number;
  user_fid: number;
  user_username: string;
  signer_uuid: string;
  city: string;
  ipfs_cid: string;
}

class NullCastFixer {
  private flashcastrFlashesDb: FlashcastrFlashesDb;
  private neynarUsers: NeynarUsers;
  private fid: number;

  constructor(fid: number) {
    this.fid = fid;
    this.flashcastrFlashesDb = new FlashcastrFlashesDb();
    this.neynarUsers = new NeynarUsers();
  }

  /**
   * Get all casts with null hash for a specific FID
   */
  private async getNullCastsForFid(): Promise<NullCast[]> {
    return await this.flashcastrFlashesDb.getNullCastsForFid(this.fid);
  }

  /**
   * Cast a flash that has never been cast
   */
  private async castFlash(nullCast: NullCast): Promise<boolean> {
    try {
      const decryptionKey = process.env.SIGNER_ENCRYPTION_KEY;

      if (!decryptionKey) {
        throw new Error("SIGNER_ENCRYPTION_KEY is not defined");
      }

      console.log(`  ↻ Casting flash ${nullCast.flash_id} for @${nullCast.user_username}...`);

      const castHash = await this.neynarUsers.publishCast({
        signerUuid: decrypt(nullCast.signer_uuid, decryptionKey),
        msg: `I just flashed an Invader in ${nullCast.city}! 👾`,
        embeds: [{ url: `https://www.flashcastr.app/flash/${nullCast.flash_id}` }],
        channelId: "invaders",
      });

      // Update the cast hash in database
      await this.flashcastrFlashesDb.updateCastHash(nullCast.flash_id, castHash);

      console.log(`  ✅ Successfully cast! Hash: ${castHash}`);
      return true;
    } catch (error: any) {
      console.error(`  ❌ Failed to cast flash ${nullCast.flash_id}:`, error.message);
      return false;
    }
  }

  /**
   * Main function to cast all null hashes for a FID
   */
  public async run(): Promise<void> {
    console.log(`🔍 Finding null casts for FID ${this.fid}...\n`);

    try {
      // Get all null casts for this FID
      const nullCasts = await this.getNullCastsForFid();

      if (nullCasts.length === 0) {
        console.log(`✨ No null casts found for FID ${this.fid}. All flashes have been cast!`);
        return;
      }

      console.log("=" .repeat(60));
      console.log(`📊 Found ${nullCasts.length} uncast flash(es) for @${nullCasts[0].user_username} (FID ${this.fid})`);
      console.log("=" .repeat(60));

      // Display null casts
      console.log("\nFlashes to cast:\n");
      nullCasts.forEach((cast, index) => {
        console.log(`${index + 1}. Flash ${cast.flash_id} in ${cast.city}`);
      });

      console.log("\n🔧 Starting cast process...\n");

      let successCount = 0;
      let failCount = 0;

      for (const cast of nullCasts) {
        const success = await this.castFlash(cast);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }

        // Rate limit: delay between casts
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      console.log("\n" + "=" .repeat(60));
      console.log("📊 Cast Summary:");
      console.log("=" .repeat(60));
      console.log(`✅ Successfully cast: ${successCount}`);
      console.log(`❌ Failed to cast: ${failCount}`);
      console.log("=" .repeat(60));

      if (successCount > 0) {
        console.log("\n✨ Null casts have been fixed!");
      }
    } catch (error) {
      console.error("\n❌ Error during null cast fixing:", error);
      throw error;
    }
  }
}

// Parse FID from command line arguments
const args = process.argv.slice(2);
const fidArg = args.find((arg) => arg.startsWith("fid="));

if (!fidArg) {
  console.error("❌ Error: FID parameter is required");
  console.error("\nUsage: npm run cast-nulls fid=<FID>");
  console.error("Example: npm run cast-nulls fid=732");
  process.exit(1);
}

const fid = parseInt(fidArg.split("=")[1]);

if (isNaN(fid) || fid <= 0) {
  console.error("❌ Error: Invalid FID. Must be a positive number.");
  process.exit(1);
}

// Run the script
const fixer = new NullCastFixer(fid);
fixer
  .run()
  .then(() => {
    console.log("\n✅ Null cast fix complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Null cast fix failed:", error);
    process.exit(1);
  });
