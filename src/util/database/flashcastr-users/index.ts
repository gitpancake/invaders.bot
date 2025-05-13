import { Postgres } from "../postgres";
import pool from "../postgresClient";
import { User } from "./types";

export class FlashcastrUsersDb extends Postgres<User> {
  constructor() {
    super(pool);
  }

  async getMany(filter: Partial<User>): Promise<User[]> {
    const values: any[] = [];

    const conditions = Object.entries(filter).map(([key, val], i) => {
      values.push(val);
      return `${key} = $${i + 1}`;
    });

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM flashcastr_users ${whereClause}`;

    return this.query(sql, values);
  }
}
