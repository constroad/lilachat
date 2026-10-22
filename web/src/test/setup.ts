import '@testing-library/jest-dom/vitest';
// La base local (W1) vive en IndexedDB, que jsdom no trae.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { forgetAllSpaces } from '../spaces/spaceCache';

// The spaces' cache lives at module level (22/10): each test starts without what the previous one saw.
afterEach(() => forgetAllSpaces());
