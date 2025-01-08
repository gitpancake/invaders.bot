import { CastAddMessage, CastType, FarcasterNetwork, HubResult, NobleEd25519Signer, Signer, makeCastAdd } from "@farcaster/hub-nodejs";

interface DataOptions {
  fid: number;
  network: FarcasterNetwork;
}

class Farcaster {
  private signer: Signer;
  private dataOptions: DataOptions;

  constructor() {
    if (!process.env.FARCASTER_ID) {
      throw new Error("FID not provided");
    }

    if (!process.env.FARCASTER_PRIVATE_KEY) {
      throw new Error("FARCASTER_PRIVATE_KEY not provided");
    }

    this.signer = new NobleEd25519Signer((process.env.FARCASTER_PRIVATE_KEY as unknown as Uint8Array)!.slice(2));

    this.dataOptions = {
      fid: parseInt(process.env.FARCASTER_ID, 10),
      network: FarcasterNetwork.MAINNET,
    };
  }

  public async postCast(message: string): Promise<HubResult<CastAddMessage>> {
    return await makeCastAdd(
      {
        text: message,
        embeds: [],
        embedsDeprecated: [],
        mentions: [],
        mentionsPositions: [],
        type: CastType.CAST,
      },
      this.dataOptions,
      this.signer
    );
  }
}

export default Farcaster;
