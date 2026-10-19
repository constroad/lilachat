import '@testing-library/jest-dom/vitest';
// La base local (W1) vive en IndexedDB, que jsdom no trae.
import 'fake-indexeddb/auto';
