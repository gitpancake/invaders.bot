import * as fs from 'fs';
import * as path from 'path';
import { Flash } from '../database/invader-flashes/types';

export class DiskPersistence {
  private failedFlashesDir: string;

  constructor() {
    this.failedFlashesDir = path.join(process.cwd(), 'failed-flashes');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.failedFlashesDir)) {
      fs.mkdirSync(this.failedFlashesDir, { recursive: true });
      console.log(`[DiskPersistence] Created directory: ${this.failedFlashesDir}`);
    }
  }

  public async persistFailedFlashes(flashes: Flash[], errorContext: string): Promise<void> {
    if (!flashes.length) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `failed-flashes-${timestamp}.json`;
    const filepath = path.join(this.failedFlashesDir, filename);

    const persistData = {
      timestamp: new Date().toISOString(),
      errorContext,
      flashCount: flashes.length,
      flashes: flashes.map(flash => ({
        flash_id: flash.flash_id,
        city: flash.city,
        player: flash.player,
        img: flash.img,
        ipfs_cid: flash.ipfs_cid,
        text: flash.text,
        timestamp: flash.timestamp,
        flash_count: flash.flash_count
      }))
    };

    try {
      fs.writeFileSync(filepath, JSON.stringify(persistData, null, 2));
      console.log(`[DiskPersistence] Persisted ${flashes.length} failed flashes to ${filename}`);
      console.log(`[DiskPersistence] Error context: ${errorContext}`);
      console.log(`[DiskPersistence] Flash IDs: ${flashes.map(f => f.flash_id).join(', ')}`);
    } catch (writeError) {
      console.error(`[DiskPersistence] Failed to persist flashes to disk:`, writeError);
    }
  }

  public async getFailedFlashes(): Promise<{ file: string; data: any }[]> {
    const files: { file: string; data: any }[] = [];
    
    try {
      const filenames = fs.readdirSync(this.failedFlashesDir);
      
      for (const filename of filenames) {
        if (filename.endsWith('.json')) {
          const filepath = path.join(this.failedFlashesDir, filename);
          const content = fs.readFileSync(filepath, 'utf-8');
          const data = JSON.parse(content);
          files.push({ file: filename, data });
        }
      }
      
      // Sort by timestamp (newest first)
      files.sort((a, b) => new Date(b.data.timestamp).getTime() - new Date(a.data.timestamp).getTime());
      
      return files;
    } catch (error) {
      console.error(`[DiskPersistence] Error reading failed flashes:`, error);
      return [];
    }
  }

  public async retryFailedFlashes(): Promise<Flash[]> {
    const files = await this.getFailedFlashes();
    const allFailedFlashes: Flash[] = [];

    for (const { file, data } of files) {
      console.log(`[DiskPersistence] Found failed flashes file: ${file} (${data.flashCount} flashes from ${data.timestamp})`);
      allFailedFlashes.push(...data.flashes);
    }

    if (allFailedFlashes.length > 0) {
      console.log(`[DiskPersistence] Total failed flashes to retry: ${allFailedFlashes.length}`);
    }

    return allFailedFlashes;
  }

  public async clearFailedFlashes(filename?: string): Promise<void> {
    try {
      if (filename) {
        const filepath = path.join(this.failedFlashesDir, filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          console.log(`[DiskPersistence] Cleared failed flashes file: ${filename}`);
        }
      } else {
        const filenames = fs.readdirSync(this.failedFlashesDir);
        for (const file of filenames) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.failedFlashesDir, file));
          }
        }
        console.log(`[DiskPersistence] Cleared all failed flashes files (${filenames.length} files)`);
      }
    } catch (error) {
      console.error(`[DiskPersistence] Error clearing failed flashes:`, error);
    }
  }

  public getFailedFlashesCount(): number {
    try {
      const filenames = fs.readdirSync(this.failedFlashesDir);
      return filenames.filter(f => f.endsWith('.json')).length;
    } catch (error) {
      return 0;
    }
  }
}