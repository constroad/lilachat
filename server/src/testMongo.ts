import { MongoMemoryServer } from 'mongodb-memory-server';

/** How many times to try before giving up. */
const ATTEMPTS = 4;

/**
 * The in-memory MongoDB of the tests, tried again when its port is taken.
 * `MongoMemoryServer` picks a free random port and only then binds it; in
 * between, another process can take it (other sessions on this Mac run their
 * tests too, or a `mongod` of a previous file is still letting go). The gate
 * then failed «Port … already in use» on a random file, which read as a flaky
 * test (21/10). Only for the tests: `index.ts` never imports it.
 */
export async function startTestMongo(create: () => Promise<MongoMemoryServer> = () => MongoMemoryServer.create()): Promise<MongoMemoryServer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      return await create();
    } catch (error) {
      lastError = error;
      if (!String(error instanceof Error ? error.message : error).includes('already in use')) throw error;
    }
  }
  throw lastError;
}
