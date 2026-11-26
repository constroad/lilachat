import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PictureInBubble } from './PictureInBubble';

// José 26/11: «en WhatsApp se ve bien el tema de pdf, videos e imágenes… no en la web de Lilachat».
describe('a photo or video in the web bubble', () => {
  const photo = { url: 'https://x/p.jpg', mime: 'image/jpeg', width: 720, height: 1280 };

  it('fills a 300 px frame in its own shape, cropped to 4:5 when tall', () => {
    render(<PictureInBubble testId="foto-a" media={photo} alt="Foto" uploading={false} onOpen={vi.fn()} />);
    const frame = screen.getByTestId('foto-a');
    expect(frame.style.width).toBe('300px');
    expect(frame.style.aspectRatio).toBe('0.8');
    expect(frame.querySelector('img')?.className).toContain('object-cover');
  });

  it('a WhatsApp video without a size takes the shape of its thumbnail once it loads', () => {
    render(<PictureInBubble testId="foto-b" media={{ url: 'https://x/v.mp4', thumbUrl: 'https://x/t.jpg', mime: 'video/mp4' }} alt="Video" uploading={false} onOpen={vi.fn()} />);
    const frame = screen.getByTestId('foto-b');
    expect(frame.style.aspectRatio).toBe('1.3333');
    const image = frame.querySelector('img')!;
    Object.defineProperty(image, 'naturalWidth', { value: 1080 });
    Object.defineProperty(image, 'naturalHeight', { value: 1920 });
    fireEvent.load(image);
    expect(frame.style.aspectRatio).toBe('0.8');
  });

  it('a video shows its length bottom-left, like WhatsApp', () => {
    render(<PictureInBubble testId="foto-c" media={{ url: 'https://x/v.mp4', thumbUrl: 'https://x/t.jpg', mime: 'video/mp4', durationMs: 23_400 }} alt="Video" uploading={false} onOpen={vi.fn()} />);
    expect(screen.getByTestId('duracion-foto-c').textContent).toBe('0:23');
  });

  it('without a caption the time goes over the picture', () => {
    render(<PictureInBubble testId="foto-d" media={photo} alt="Foto" uploading={false} onOpen={vi.fn()} overlay={<span>9:31 a. m.</span>} />);
    expect(screen.getByTestId('foto-d').textContent).toContain('9:31 a. m.');
  });

  it('opens the viewer, but not while it uploads', () => {
    const onOpen = vi.fn();
    const { rerender } = render(<PictureInBubble testId="foto-e" media={photo} alt="Foto" uploading onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('foto-e'));
    expect(onOpen).not.toHaveBeenCalled();
    rerender(<PictureInBubble testId="foto-e" media={photo} alt="Foto" uploading={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('foto-e'));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
