/** Drag a vertical splitter. onMove gets pointer delta in CSS pixels. */

export function dragColumn(handle: HTMLElement, onMove: (dx: number) => void): void {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    handle.classList.add('dragging');
    handle.setPointerCapture(event.pointerId);
    let last = event.clientX;
    const move = (next: PointerEvent) => {
      onMove(next.clientX - last);
      last = next.clientX;
    };
    const up = () => {
      handle.classList.remove('dragging');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
