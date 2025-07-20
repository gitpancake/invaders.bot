import { Postgres } from "../postgres";
import pool from "../postgresClient";
import { Flash } from "./types";

export class PostgresFlashesDb extends Postgres<Flash> {
  constructor() {
    super(pool);
  }

  async getSinceByPlayers(sinceUnix: number, usernames: string[]): Promise<Flash[]> {
    const sql = `
      SELECT * FROM flashes
      WHERE timestamp >= to_timestamp($1) AND LOWER(player) = ANY($2)
      ORDER BY timestamp DESC
    `;

    const params = [
      sinceUnix,
      usernames.map((u) => u.toLowerCase()), // safe + efficient
    ];

    return await this.query(sql, params);
  }

  async getSince(sinceUnix: number): Promise<Flash[]> {
    const sql = `
      SELECT * FROM flashes
      WHERE timestamp >= to_timestamp($1)
      ORDER BY timestamp DESC
    `;

    return await this.query(sql, [sinceUnix]);
  }

  async writeMany(flashes: Flash[]): Promise<Flash[]> {
    if (!flashes.length) return [];

    const values: any[] = [];
    const valuePlaceholders = flashes.map((flash, i) => {
      const offset = i * 7;
      values.push(flash.flash_id, flash.city, flash.player, flash.img, flash.text, new Date(flash.timestamp * 1000), flash.flash_count);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    });

    const sql = `
      INSERT INTO flashes (
        flash_id, city, player, img, text, timestamp, flash_count
      ) VALUES
        ${valuePlaceholders.join(",")}
      ON CONFLICT (flash_id) DO NOTHING
      RETURNING *;
    `;

    return await this.query(sql, values);
  }
}
