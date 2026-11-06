import { fireEvent, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { PullToRefresh, pullOffset, PULL_TRIGGER_PX } from './pullToRefresh';

const touch = (y: number) => ({ touches: [{ clientY: y }] });

function drawList(scrollTop = 0) {
  const onRefresh = vi.fn();
  render(
    <PullToRefresh onRefresh={onRefresh}>
      <div data-testid="lista" style={{ overflowY: 'auto' }} ref={(element) => { if (element) element.scrollTop = scrollTop; }}>chats</div>
    </PullToRefresh>
  );
  const list = screen.getByTestId('lista');
  return { list, onRefresh };
}

describe('pullOffset', () => {
  it('moves less than the finger, and never up', () => {
    expect(pullOffset(100)).toBeLessThan(100);
    expect(pullOffset(-50)).toBe(0);
  });
});

describe('PullToRefresh (José 06/11: the web could not be refreshed with the finger)', () => {
  it('a pull past the mark refreshes when the finger lets go', () => {
    // Arrange
    const { list, onRefresh } = drawList();
    // Act
    fireEvent.touchStart(list, touch(100));
    fireEvent.touchMove(list, touch(100 + PULL_TRIGGER_PX * 3));
    expect(screen.getByTestId('jalar-para-actualizar')).toHaveTextContent('Suelta para actualizar');
    fireEvent.touchEnd(list);
    // Assert
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('a short pull goes back without refreshing', () => {
    // Arrange
    const { list, onRefresh } = drawList();
    // Act
    fireEvent.touchStart(list, touch(100));
    fireEvent.touchMove(list, touch(120));
    expect(screen.getByTestId('jalar-para-actualizar')).toHaveTextContent('Desliza para actualizar');
    fireEvent.touchEnd(list);
    // Assert
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.queryByTestId('jalar-para-actualizar')).toBeNull();
  });

  it('a list scrolled down keeps scrolling: pulling is only from the top', () => {
    // Arrange
    const { list, onRefresh } = drawList(40);
    // Act
    fireEvent.touchStart(list, touch(100));
    fireEvent.touchMove(list, touch(100 + PULL_TRIGGER_PX * 3));
    fireEvent.touchEnd(list);
    // Assert
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.queryByTestId('jalar-para-actualizar')).toBeNull();
  });

  it('a sheet opened from the list does not pull the list behind it', () => {
    // Arrange
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh}>{createPortal(<div data-testid="hoja">hoja</div>, document.body)}</PullToRefresh>);
    const sheet = screen.getByTestId('hoja');
    // Act
    fireEvent.touchStart(sheet, touch(100));
    fireEvent.touchMove(sheet, touch(100 + PULL_TRIGGER_PX * 3));
    fireEvent.touchEnd(sheet);
    // Assert
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('swiping up never pulls', () => {
    // Arrange
    const { list, onRefresh } = drawList();
    // Act
    fireEvent.touchStart(list, touch(300));
    fireEvent.touchMove(list, touch(100));
    fireEvent.touchEnd(list);
    // Assert
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
