import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const DEFAULT_DATA = {
  articles: [],
  profiles: {},
  bookmarks: {},
  sourceConfig: {},
  sourceHealth: {},
  sourceErrors: [],
  lastUpdatedAt: null
};

export async function loadStore() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch (error) {
    return { ...DEFAULT_DATA };
  }
}

export async function saveStore(snapshot) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf-8");
}
