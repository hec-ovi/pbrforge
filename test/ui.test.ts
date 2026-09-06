// @vitest-environment jsdom
import { fireEvent, getByRole, getByText } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PreviewView } from '../src/ui/views/PreviewView.js';
import type { SphereViewer } from '../src/ui/widgets/SphereViewer.js';
import type { MaterialEntry } from '../src/db/types.js';

const entry: MaterialEntry = {
  key: 'cyberpunk/wall/poor',
  alignment: 'tile',
  tiling: { worldSize: [3, 3] },
  physical: {},
  variants: [
    { id: '1', resolution: [64, 64], maps: { basecolor: 'a.png', normal: 'b.png', roughness: 'c.png', metallic: 'd.png' } },
    { id: '2', resolution: [64, 64], maps: { basecolor: 'e.png', normal: 'f.png', roughness: 'g.png', metallic: 'h.png' } },
  ],
};

function fetcherFor(index: unknown): typeof fetch {
  return (async (url: string) => new Response(
    JSON.stringify(url === '/api/themes' ? ['cyberpunk'] : index),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )) as unknown as typeof fetch;
}

describe('preview contract', () => {
  it('lists database keys and loads the selection into the viewer', async () => {
    const viewer = { load: vi.fn(), canvas: document.createElement('canvas') } as unknown as SphereViewer;
    const view = new PreviewView(viewer);
    await view.list.load(fetcherFor({ theme: 'cyberpunk', entries: { [entry.key]: entry } }));

    fireEvent.click(getByText(view.root, 'cyberpunk/wall/poor'));
    expect(viewer.load).toHaveBeenCalledWith('cyberpunk', entry, 0, 2);
    expect(view.root.querySelectorAll('.tree-leaf-item img')).toHaveLength(0);
    expect(view.root.querySelectorAll('img.channel-thumb')).toHaveLength(4);
    expect(getByRole(view.root, 'button', { name: 'Export material' })).toBeTruthy();
    fireEvent.click(getByRole(view.root, 'button', { name: 'View BaseColor full size' }));
    const dialog = getByRole(document.body, 'dialog', { name: 'BaseColor' });
    const mapImg = dialog.querySelector('.map-viewer-img') as HTMLImageElement;
    const stage = dialog.querySelector('.map-viewer-stage') as HTMLElement;
    expect(mapImg).toBeTruthy();
    fireEvent.click(getByRole(dialog, 'button', { name: 'Zoom in' }));
    expect(Number(mapImg.dataset.scale)).toBeGreaterThan(1);
    fireEvent.pointerDown(stage, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(stage, { clientX: 40, clientY: 25 });
    fireEvent.pointerUp(stage, { clientX: 40, clientY: 25 });
    expect(Number(mapImg.dataset.x)).toBe(30);
    fireEvent.click(getByRole(dialog, 'button', { name: 'Reset view' }));
    fireEvent.wheel(stage, { deltaY: -120, clientX: 0, clientY: 0 });
    expect(Number(mapImg.dataset.scale)).toBeGreaterThan(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.body.querySelector('.map-viewer')).toBeNull();
    expect(getByRole(view.root, 'separator', { name: 'Resize sidebar' })).toBeTruthy();
    expect(getByRole(view.root, 'separator', { name: 'Resize inspector' })).toBeTruthy();

    const themeHeader = view.root.querySelector('.tree-node-theme') as HTMLButtonElement;
    const kindHeader = view.root.querySelector('.tree-node-kind') as HTMLButtonElement;
    expect(themeHeader.getAttribute('aria-expanded')).toBe('false');
    expect(kindHeader.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(themeHeader);
    expect(themeHeader.getAttribute('aria-expanded')).toBe('true');
    expect(kindHeader.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(kindHeader);
    expect(kindHeader.getAttribute('aria-expanded')).toBe('false');
    expect(kindHeader.nextElementSibling?.classList.contains('collapsed')).toBe(true);
    fireEvent.click(themeHeader);
    fireEvent.click(themeHeader);
    expect(kindHeader.getAttribute('aria-expanded')).toBe('true');

    fireEvent.change(getByRole(view.root, 'combobox', { name: 'variant' }), { target: { value: '1' } });
    expect(viewer.load).toHaveBeenLastCalledWith('cyberpunk', entry, 1, 2);
  });

  it('shows an empty notice when the database has no entries', async () => {
    const view = new PreviewView();
    await view.list.load(fetcherFor({ theme: 'cyberpunk', entries: {} }));
    expect(getByText(view.root, /database is empty/)).toBeTruthy();
  });
});
