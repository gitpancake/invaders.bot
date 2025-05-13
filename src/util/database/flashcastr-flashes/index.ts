import { Postgres } from "../postgres";
import pool from "../postgresClient";
import { FlashcastrFlash } from "./types";

export class FlashcastrFlashesDb extends Postgres<FlashcastrFlash> {
  constructor() {
    super(pool);
  }

  async getByFlashIds(flashIds: number[]): Promise<FlashcastrFlash[]> {
    if (!flashIds.length) return [];

    const sql = `SELECT * FROM flashcastr_flashes WHERE flash_id = ANY($1)`;

    return await this.query(sql, [flashIds]);
  }

  async insertMany(rows: FlashcastrFlash[]): Promise<FlashcastrFlash[]> {
    if (!rows.length) return [];

    const values: any[] = [];
    const valuePlaceholders = rows.map((row, i) => {
      const offset = i * 5;
      values.push(row.flash_id, row.user_fid, row.user_username, row.user_pfp_url, row.cast_hash);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    });

    const sql = `
      INSERT INTO flashcastr_flashes (
        flash_id, user_fid, user_username, user_pfp_url, cast_hash
      ) VALUES ${valuePlaceholders.join(",")}
      ON CONFLICT DO NOTHING
    `;

    return await this.query(sql, values);
  }
}
