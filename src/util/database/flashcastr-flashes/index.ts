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

  async getFailedCastsForRetry(limit: number, sinceDays: number): Promise<any[]> {
    const sql = `
      SELECT
        ff.flash_id,
        ff.user_fid,
        ff.user_username,
        ff.user_pfp_url,
        fu.signer_uuid,
        fu.auto_cast,
        inf.player,
        inf.city,
        inf.ipfs_cid,
        inf.timestamp
      FROM flashcastr_flashes ff
      INNER JOIN flashcastr_users fu ON ff.user_fid = fu.fid
      INNER JOIN invader_flashes inf ON ff.flash_id = inf.flash_id
      WHERE ff.cast_hash IS NULL
        AND fu.auto_cast = true
        AND inf.ipfs_cid IS NOT NULL
        AND inf.ipfs_cid != ''
        AND inf.timestamp > EXTRACT(EPOCH FROM NOW() - INTERVAL '${sinceDays} days')
      ORDER BY inf.timestamp DESC
      LIMIT $1
    `;

    return await this.query(sql, [limit]);
  }

  async updateCastHash(flashId: number, castHash: string): Promise<void> {
    const sql = `
      UPDATE flashcastr_flashes
      SET cast_hash = $1
      WHERE flash_id = $2
    `;

    await this.query(sql, [castHash, flashId]);
  }
}
