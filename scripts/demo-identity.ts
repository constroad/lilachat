import { homedir } from 'node:os';
import path from 'node:path';

/** Lucía's key in the demo space (`seed-demo-space.ts`): on this Mac only, never in the repo. */
export const DEMO_IDENTITY_FILE = path.join(homedir(), '.lilachat-demo', 'lucia.json');
export const LUCIA_DEVICE = 'demo-lucia';
export const LUCIA_PHONE = 'demo-01';
