import { Flash } from "../flash-invaders/types";
import { InvadersFunHandler } from "../invaders.fun";
import { FlashesDb } from "../mongodb/flashes";
import { formattedCurrentTime } from "../times";

export class PostPersonalFlash {
  public async handle(flash: Flash): Promise<void> {
    try {
      await new InvadersFunHandler().sendToPersonal(flash);

      await new FlashesDb().updateDocument(
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
