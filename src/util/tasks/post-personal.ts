import { Flash } from "../flash-invaders/types";
import { InvadersFunHandler } from "../invaders.fun";
import { FlashesDb } from "../mongodb/flashes";
import { formattedCurrentTime } from "../times";

export class PostPersonalFlash {
  public async handle(flash: Flash): Promise<void> {
    try {
      const db = new FlashesDb();

      const existingFlash = await db.getDocument({
        flash_id: flash.flash_id,
      });

      if (existingFlash?.posted) {
        return;
      }

      await new InvadersFunHandler().sendToPersonal(flash);

      await db.updateDocument(
        {
          flash_id: flash.flash_id,
        },
        {
          posted: true,
        }
      );

      console.log(`Posted personal #${flash.flash_id}. ${formattedCurrentTime()}`);
    } catch (err) {
      console.error(`Error fetching random flash:`, err);
    }
  }
}
