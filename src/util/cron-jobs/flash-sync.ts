import { getUnixTime } from "date-fns";
import { FlashcastrFlashesDb } from "../mongodb/flashcastr";
import { Flashcastr } from "../mongodb/flashcastr/types";
import { FlashesDb } from "../mongodb/flashes";
import { FlashcastrUsersDb } from "../mongodb/users";
import { Users } from "../neynar/users";
import { formattedCurrentTime } from "../times";
import { CronTask } from "./base";

export class FlashSyncCron extends CronTask {
  private flashTimespanMins = 5;

  constructor(schedule: string) {
    super("flash-sync", schedule);
  }

  public async task(): Promise<void> {
    try {
      // Get all registered users
      const usersDb = new FlashcastrUsersDb();
      const users = await usersDb.getMany({});

      if (users.length === 0) {
        return; // No users to process
      }

      // Get unique fids and fetch corresponding Neynar users
      const uniqueFids = Array.from(new Set(users.map((user) => user.fid)));
      const neynarUsers = await new Users().getUsersByFids(uniqueFids);

      // Create lookup map for faster user matching
      const neynarUserMap = new Map(neynarUsers.map((user) => [user.fid, user]));

      const flashesDb = new FlashesDb();
      const flashes = await flashesDb.getMany({
        timestamp: {
          $gte: getUnixTime(Date.now() - this.flashTimespanMins * 60 * 1000),
        },
        player: {
          $in: users.map((user) => user.username),
        },
      });

      if (flashes.length === 0) {
        return; // No flashes to process
      }

      // Create array to store auto-cast promises
      const autoCastPromises: Promise<void>[] = [];

      // Process flashes and prepare auto-casts
      const flashcastrFlashes: Flashcastr[] = flashes.map((flash) => {
        const user = users.find((user) => user.username === flash.player);
        if (!user) {
          throw new Error(`User not found for flash: ${flash.flash_id}`);
        }

        // Queue up auto-cast if enabled for user
        if (user.auto_cast) {
          // Each publishCast creates a new Users instance and fires request immediately
          autoCastPromises.push(
            new Users().publishCast({
              signerUuid: user.signer_uuid,
              msg: `I just flashed an Invader in ${flash.city}! 👾`,
              embeds: [{ url: `${process.env.S3_URL}${flash.img}` }],
              channelId: "invaders",
            })
          );
        }

        const neynarUser = neynarUserMap.get(user.fid);
        if (!neynarUser) {
          throw new Error(`Neynar user not found for flash: ${flash.flash_id}`);
        }

        return {
          flash,
          user: neynarUser,
        };
      });

      // Store processed flashes
      if (flashcastrFlashes.length > 0) {
        await new FlashcastrFlashesDb().insertMany(flashcastrFlashes);
      }

      // Wait for all auto-casts to complete
      await Promise.all(autoCastPromises);

      console.log(`${flashcastrFlashes.length} flashes. ${autoCastPromises.length} auto-casts. ${formattedCurrentTime()}`);
    } catch (error) {
      console.error("Error storing flashcastr flashes:", error);
    }
  }
}
