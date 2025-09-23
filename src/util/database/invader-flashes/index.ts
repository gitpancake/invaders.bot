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

  async getByIds(flashIds: number[]): Promise<Flash[]> {
    if (flashIds.length === 0) return [];

    const placeholders = flashIds.map((_, i) => `$${i + 1}`).join(',');
    const sql = `SELECT * FROM flashes WHERE flash_id IN (${placeholders})`;
    
    return await this.query(sql, flashIds);
  }

  async writeMany(flashes: Flash[]): Promise<Flash[]> {
    if (!flashes.length) return [];

    // Validate and sanitize flashes before attempting batch insert
    const validFlashes: Flash[] = [];
    const invalidFlashes: { flash: Flash, errors: string[] }[] = [];

    for (const flash of flashes) {
      const errors = this.validateFlash(flash);
      if (errors.length === 0) {
        validFlashes.push(this.sanitizeFlash(flash));
      } else {
        invalidFlashes.push({ flash, errors });
        console.warn(`[PostgresFlashesDb] Invalid flash ${flash.flash_id} (${flash.player}): ${errors.join(', ')}`);
      }
    }

    // Log validation results
    if (invalidFlashes.length > 0) {
      console.error(`[PostgresFlashesDb] ${invalidFlashes.length}/${flashes.length} flashes failed validation and will be skipped`);
      
      // Group by error type for better debugging
      const errorsByType = new Map<string, number>();
      invalidFlashes.forEach(({ errors }) => {
        errors.forEach(error => {
          errorsByType.set(error, (errorsByType.get(error) || 0) + 1);
        });
      });
      
      console.error(`[PostgresFlashesDb] Validation error breakdown:`, Object.fromEntries(errorsByType));
    }

    if (validFlashes.length === 0) {
      console.warn(`[PostgresFlashesDb] No valid flashes to insert after validation`);
      return [];
    }

    console.log(`[PostgresFlashesDb] Inserting ${validFlashes.length}/${flashes.length} validated flashes`);

    const values: any[] = [];
    const valuePlaceholders = validFlashes.map((flash, i) => {
      const offset = i * 8;
      values.push(flash.flash_id, flash.city, flash.player, flash.img, flash.ipfs_cid, flash.text, new Date(flash.timestamp * 1000), flash.flash_count);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
    });

    const sql = `
      INSERT INTO flashes (
        flash_id, city, player, img, ipfs_cid, text, timestamp, flash_count
      ) VALUES
        ${valuePlaceholders.join(",")}
      ON CONFLICT (flash_id) DO NOTHING
      RETURNING *;
    `;

    try {
      const result = await this.query(sql, values);
      if (result.length < validFlashes.length) {
        console.log(`[PostgresFlashesDb] ${validFlashes.length - result.length} flashes were skipped due to conflicts (already exist)`);
      }
      return result;
    } catch (error) {
      console.error(`[PostgresFlashesDb] Batch insert failed even after validation:`, error);
      
      // Fallback to individual inserts for debugging
      console.log(`[PostgresFlashesDb] Falling back to individual inserts to identify problematic records`);
      return await this.insertIndividually(validFlashes);
    }
  }

  private validateFlash(flash: Flash): string[] {
    const errors: string[] = [];

    // Validate flash_id
    if (!flash.flash_id || typeof flash.flash_id !== 'number' || flash.flash_id <= 0) {
      errors.push('invalid_flash_id');
    }

    // Validate timestamp
    if (!flash.timestamp || typeof flash.timestamp !== 'number' || flash.timestamp <= 0) {
      errors.push('invalid_timestamp');
    } else {
      // Check if timestamp is reasonable (not too far in past/future)
      const date = new Date(flash.timestamp * 1000);
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      
      if (date < twoYearsAgo || date > oneYearFromNow) {
        errors.push('timestamp_out_of_range');
      }
    }

    // Validate required string fields
    if (!flash.city || typeof flash.city !== 'string' || flash.city.trim().length === 0) {
      errors.push('missing_city');
    } else if (flash.city.length > 100) {
      errors.push('city_too_long');
    }

    if (!flash.player || typeof flash.player !== 'string' || flash.player.trim().length === 0) {
      errors.push('missing_player');
    } else if (flash.player.length > 100) {
      errors.push('player_name_too_long');
    }

    if (!flash.img || typeof flash.img !== 'string' || flash.img.trim().length === 0) {
      errors.push('missing_img');
    } else if (flash.img.length > 500) {
      errors.push('img_path_too_long');
    }

    // Validate optional fields
    if (flash.text && typeof flash.text === 'string' && flash.text.length > 1000) {
      errors.push('text_too_long');
    }

    if (flash.flash_count && typeof flash.flash_count === 'string' && flash.flash_count.length > 50) {
      errors.push('flash_count_too_long');
    }

    if (flash.ipfs_cid && (typeof flash.ipfs_cid !== 'string' || flash.ipfs_cid.length > 255)) {
      errors.push('invalid_ipfs_cid');
    }

    return errors;
  }

  private sanitizeFlash(flash: Flash): Flash {
    return {
      ...flash,
      // Trim and sanitize strings
      city: flash.city?.trim() || '',
      player: flash.player?.trim() || '',
      img: flash.img?.trim() || '',
      text: flash.text?.trim() || '',
      flash_count: flash.flash_count?.trim() || '',
      ipfs_cid: flash.ipfs_cid?.trim() || '',
      
      // Ensure numeric fields are proper types
      flash_id: Number(flash.flash_id),
      timestamp: Number(flash.timestamp),
    };
  }

  private async insertIndividually(flashes: Flash[]): Promise<Flash[]> {
    const successful: Flash[] = [];
    const failed: { flash: Flash, error: string }[] = [];

    for (const flash of flashes) {
      try {
        const sql = `
          INSERT INTO flashes (
            flash_id, city, player, img, ipfs_cid, text, timestamp, flash_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (flash_id) DO NOTHING
          RETURNING *;
        `;
        
        const values = [
          flash.flash_id, flash.city, flash.player, flash.img, 
          flash.ipfs_cid, flash.text, new Date(flash.timestamp * 1000), flash.flash_count
        ];
        
        const result = await this.query(sql, values);
        if (result.length > 0) {
          successful.push(result[0]);
        } else {
          console.log(`[PostgresFlashesDb] Flash ${flash.flash_id} already exists (conflict)`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        failed.push({ flash, error: errorMsg });
        console.error(`[PostgresFlashesDb] Individual insert failed for flash ${flash.flash_id} (${flash.player}):`, errorMsg);
      }
    }

    if (failed.length > 0) {
      console.error(`[PostgresFlashesDb] ${failed.length} individual inserts failed after validation`);
    }

    return successful;
  }
}
