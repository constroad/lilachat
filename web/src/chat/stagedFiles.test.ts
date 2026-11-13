import { describe, expect, it } from 'vitest';
import { MAX_STAGED_FILES, stageFiles } from './stagedFiles';

const file = (name: string) => new File(['x'], name, { type: 'image/jpeg', lastModified: 1 });

describe('stageFiles (José 13/11: thumbnails inside the field)', () => {
  it('adds up without repeating the same file, up to the limit', () => {
    const a = file('a.jpg');
    expect(stageFiles([a], [a, file('b.jpg')]).map((one) => one.name)).toEqual(['a.jpg', 'b.jpg']);
    const many = Array.from({ length: MAX_STAGED_FILES + 2 }, (_, index) => file(`${index}.jpg`));
    expect(stageFiles([], many)).toHaveLength(MAX_STAGED_FILES);
  });
});
