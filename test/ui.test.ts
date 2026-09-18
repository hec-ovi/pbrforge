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
  it('loads the database, drives the viewer from a selection and routes the controls', async () => {
    const viewer = {
      canvas: document.createElement('canvas'), load: vi.fn(), setLightingPreset: vi.fn(),
      setBackgroundMode: vi.fn(), toggleAutoRotate: vi.fn(), toggleWireframe: vi.fn(), resetCamera: vi.fn(),
    } as unknown as SphereViewer;
    const view = new PreviewView(viewer);
    await view.list.load(fetcherFor({ theme: 'cyberpunk', entries: { [entry.key]: entry } }));

    fireEvent.click(getByText(view.root, 'cyberpunk/wall/poor'));
    expect(viewer.load).toHaveBeenCalledWith('cyberpunk', entry, 0, 2);
    expect(view.root.querySelectorAll('img.channel-thumb')).toHaveLength(4);
    expect(getByRole(view.root, 'button', { name: 'Export material' })).toBeTruthy();

    fireEvent.click(getByRole(view.root, 'button', { name: 'View BaseColor full size' }));
    expect(getByRole(document.body, 'dialog', { name: 'BaseColor' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.body.querySelector('.map-viewer')).toBeNull();

    fireEvent.change(getByRole(view.root, 'combobox', { name: 'variant' }), { target: { value: '1' } });
    expect(viewer.load).toHaveBeenLastCalledWith('cyberpunk', entry, 1, 2);
    fireEvent.change(getByRole(view.root, 'combobox', { name: 'lighting preset' }), { target: { value: 'neon' } });
    expect(viewer.setLightingPreset).toHaveBeenCalledWith('neon');
    fireEvent.change(getByRole(view.root, 'combobox', { name: 'background mode' }), { target: { value: 'grid' } });
    expect(viewer.setBackgroundMode).toHaveBeenCalledWith('grid');
    fireEvent.click(getByRole(view.root, 'button', { name: 'Toggle spin' }));
    expect(viewer.toggleAutoRotate).toHaveBeenCalled();
    fireEvent.click(getByRole(view.root, 'button', { name: 'Toggle wireframe' }));
    expect(viewer.toggleWireframe).toHaveBeenCalled();
    fireEvent.click(getByRole(view.root, 'button', { name: 'Reset camera' }));
    expect(viewer.resetCamera).toHaveBeenCalled();
  });

  it('reports a database it cannot load and renders the error', async () => {
    const view = new PreviewView();
    const fetcher = (async () => new Response(null, { status: 503 })) as typeof fetch;
    await expect(view.list.load(fetcher)).rejects.toMatchObject({ code: 'E_DATABASE_UNAVAILABLE' });
    fireEvent.click(getByRole(view.root, 'button', { name: 'Refresh list' }));
    await vi.waitFor(() => expect(view.root.textContent).toContain('material database could not be loaded'));
  });
});
