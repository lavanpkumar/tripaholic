import { mongoConfigured } from "../db";
import { fileColl, mongoColl, type Coll, type CollName, type Doc } from "./collections";

export type StoreMode = "mongo" | "file";

/** MongoDB Atlas when MONGODB_URI is set, otherwise the local JSON file store. */
export function storeMode(): StoreMode {
  return mongoConfigured() ? "mongo" : "file";
}

export function coll<T extends Doc>(name: CollName): Coll<T> {
  return storeMode() === "mongo" ? mongoColl<T>(name) : fileColl<T>(name);
}
