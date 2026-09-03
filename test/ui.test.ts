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

    fireEvent.change(getByRole(view.root, 'combobox', { name: 'variant' }), { target: { value: '1' } });
    expect(viewer.load).toHaveBeenLastCalledWith('cyberpunk', entry, 1, 2);
  });

  it('shows an empty notice when the database has no entries', async () => {
    const view = new PreviewView();
    await view.list.load(fetcherFor({ theme: 'cyberpunk', entries: {} }));
    expect(getByText(view.root, /database is empty/)).toBeTruthy();
  });
});
