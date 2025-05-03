import { getUnixTime, sub } from "date-fns";
import { Flash } from "../flash-invaders/types";
import { InvadersFunHandler } from "../invaders.fun";
import { FlashesDb } from "../mongodb/flashes";
import { CronTask } from "./base";

type Theme = {
  type: "city" | "player" | "color";
  value: string;
  startTime: number;
  endTime: number;
};

export class AgenticPoster extends CronTask {
  private currentTheme: Theme | null = null;
  private readonly themeDuration = 24 * 60 * 60; // 24 hours in seconds

  constructor(schedule: string) {
    super("agentic-poster", schedule);
  }

  private async selectNewTheme(): Promise<Theme> {
    const db = new FlashesDb();
    const recentFlashes = await db.getRecentFlashes(100); // We'll need to add this method

    // Simple strategy: rotate between city, player, and color themes
    const themeTypes: Theme["type"][] = ["city", "player", "color"];
    const lastThemeType = this.currentTheme?.type || "color";
    const nextThemeType = themeTypes[(themeTypes.indexOf(lastThemeType) + 1) % themeTypes.length];

    let themeValue: string;
    switch (nextThemeType) {
      case "city":
        themeValue = this.selectRandomCity(recentFlashes);
        break;
      case "player":
        themeValue = this.selectRandomPlayer(recentFlashes);
        break;
      case "color":
        themeValue = this.selectRandomColor(recentFlashes);
        break;
    }

    const now = getUnixTime(new Date());
    return {
      type: nextThemeType,
      value: themeValue,
      startTime: now,
      endTime: now + this.themeDuration,
    };
  }

  private selectRandomCity(flashes: Flash[]): string {
    const cities = [...new Set(flashes.map((f) => f.city))];
    return cities[Math.floor(Math.random() * cities.length)];
  }

  private selectRandomPlayer(flashes: Flash[]): string {
    const players = [...new Set(flashes.map((f) => f.player))];
    return players[Math.floor(Math.random() * players.length)];
  }

  private selectRandomColor(flashes: Flash[]): string {
    // For now, we'll use a simple color selection
    // In the future, we could analyze the images to determine dominant colors
    const colors = ["red", "blue", "green", "yellow", "black", "white"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  public async task(): Promise<void> {
    try {
      // Check if we need a new theme
      const now = getUnixTime(new Date());
      if (!this.currentTheme || now >= this.currentTheme.endTime) {
        this.currentTheme = await this.selectNewTheme();
        console.log(`New theme selected: ${this.currentTheme.type} - ${this.currentTheme.value}`);
      }

      // Get a flash matching the current theme
      const flash = await this.getThemeMatchingFlash();
      if (!flash) {
        console.log(`No matching flash found for theme: ${this.currentTheme.type} - ${this.currentTheme.value}`);
        return;
      }

      // Post the flash
      await new InvadersFunHandler().sendToBot(flash);
      await new FlashesDb().updateDocument({ flash_id: flash.flash_id }, { posted: true });

      console.log(`Posted #${flash.flash_id} matching theme ${this.currentTheme.type} - ${this.currentTheme.value}`);
    } catch (err) {
      console.error(`Error in agentic posting:`, err);
    }
  }

  private async getThemeMatchingFlash(): Promise<Flash | null> {
    if (!this.currentTheme) return null;

    const query: any = {
      $or: [{ posted: true }, { posted: { $exists: false } }],
      timestamp: { $gte: getUnixTime(sub(new Date(), { hours: 24 })) },
    };

    switch (this.currentTheme.type) {
      case "city":
        query.city = this.currentTheme.value;
        break;
      case "player":
        query.player = this.currentTheme.value;
        break;
      case "color":
        // For now, we'll use a simple text-based color matching
        // In the future, we could implement image analysis
        query.text = { $regex: this.currentTheme.value, $options: "i" };
        break;
    }

    return await new FlashesDb().getRandomDocument(query);
  }
}
