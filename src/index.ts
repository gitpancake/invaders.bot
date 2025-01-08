import axios from "axios";
import { fromUnixTime, sub } from "date-fns";
import { config } from "dotenv";
import cron from "node-cron";
import { uploadImageHandler } from "./util/images/uploader";
import SpaceInvaders from "./util/invaders";
import MongoDBService from "./util/mongodb";

config({ path: ".env" });

const main = async () => {
  const invaders = await new SpaceInvaders().getLatestFlashes();

  if (!invaders) {
    console.log("No invaders found");
    return;
  }

  const flashes = [...invaders.with_paris, ...invaders.without_paris];

  await new MongoDBService("invaders", "flashes").writeMany(flashes);

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
    console.log(`Flash posted for ${flashToPost.city}`);
  } catch (ex) {
    console.log(ex);
  }
};

const city_specific = async () => {
  const cities = ["Los Angeles", "New York", "Miami", "San Diego"];

  const invaders = await new SpaceInvaders().getLatestFlashes();

  if (!invaders) {
    console.log("No invaders found");
    return;
  }

  const flashes = [...invaders.without_paris].filter((x) => cities.includes(x.city) && fromUnixTime(x.timestamp) > sub(new Date(), { minutes: 1 }));

  if (!flashes.length) {
    return;
  }

  try {
    flashes.map(async (flashToPost) => {
      const s3Url = await uploadImageHandler({
        imageUrl: `${new SpaceInvaders().IMAGE_BASE}${flashToPost.img}`,
        key: flashToPost.img,
      });

      await axios.post(`${process.env.API_URL}/api/bot`, {
        secret: process.env.WEBHOOK_SECRET,
        flash: { ...flashToPost, img: s3Url },
      });

      console.log(`City specific flash posted: ${flashToPost.city}`);
    });
  } catch (ex) {
    console.log(ex);
  }
};

cron.schedule("* * * * *", () => {
  city_specific().catch((err) => {
    console.log(err);
  });
});

cron.schedule("*/5 * * * *", () => {
  main()
    .then(() => {})
    .catch((err) => {
      console.log(err);
    });
});
