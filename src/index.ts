import axios from "axios";
import { config } from "dotenv";
import cron from "node-cron";
import { uploadImageHandler } from "./util/images/uploader";
import SpaceInvaders from "./util/invaders";

config({ path: ".env" });

const main = async () => {
  const invaders = await new SpaceInvaders().getLatestFlashes();

  if (!invaders) {
    console.log("No invaders found");
    return;
  }

  const flashes = [...invaders.with_paris, ...invaders.without_paris];

  try {
    const flashToPost = flashes[Math.round(Math.random() * flashes.length)];

    const s3Url = await uploadImageHandler({
      imageUrl: `${new SpaceInvaders().IMAGE_BASE}${flashToPost.img}`,
      key: flashToPost.img,
    });

    await axios.post(`${process.env.API_URL}/api/bot`, {
      secret: process.env.WEBHOOK_SECRET,
      flash: { ...flashToPost, img: s3Url },
    });

    console.log("Flash posted");
  } catch (ex) {
    console.log(ex);
  }
};

cron.schedule("* * * * *", () => {
  main()
    .then(() => {
      console.log("Done!");
    })
    .catch((err) => {
      console.log(err);
    });
});
