export interface Flash {
  _id?: string;
  id?: string;
  img: string;
  ipfs_cid: string;
  city: string;
  text: string;
  player: string;
  flash_id: number;
  timestamp: number;
  flash_count: string;
  posted?: boolean;
}
