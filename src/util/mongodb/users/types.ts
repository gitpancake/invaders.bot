export type User = {
  fid: number;
  username: string;
  signer_uuid: string;
  auto_cast: boolean;
};

export type UserWithoutSigner = Omit<User, "signer_uuid">;
