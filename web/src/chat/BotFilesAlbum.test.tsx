import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BotFilesAlbum } from './BotFilesAlbum';

afterEach(cleanup);

const photo = (n: number) => ({ url: `https://lila.constroad.com/f/${n}.jpg`, mime: 'image/jpeg' });

/** A bot's files as a person's album (`specs/BOTS-API.spec.md` c-duovicies). */
describe('BotFilesAlbum', () => {
  it('draws one tile per file up to four and «+N» for the rest', () => {
    // Arrange
    const files = [1, 2, 3, 4, 5, 6].map(photo);
    // Act
    render(<BotFilesAlbum seq={9} files={files} />);
    // Assert
    expect(screen.getByTestId('album-app-9')).toBeTruthy();
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('marks a video with a play sign and no image when it has no thumbnail', () => {
    // Arrange
    const files = [photo(1), { url: 'https://lila.constroad.com/f/v.mp4', mime: 'video/mp4' }];
    // Act
    render(<BotFilesAlbum seq={3} files={files} />);
    // Assert
    expect(screen.getByTestId('album-app-foto-3-1').querySelector('img')).toBeNull();
    expect(screen.getByTestId('album-app-foto-3-1').querySelector('svg')).toBeTruthy();
  });

  it('a tap opens the viewer on that file', () => {
    // Arrange
    render(<BotFilesAlbum seq={4} files={[photo(1), photo(2)]} />);
    // Act
    fireEvent.click(screen.getByTestId('album-app-foto-4-1'));
    // Assert
    const shown = [...document.querySelectorAll('img')].filter((img) => img.getAttribute('src')?.endsWith('/2.jpg'));
    expect(shown.length).toBeGreaterThan(1);
  });
});
