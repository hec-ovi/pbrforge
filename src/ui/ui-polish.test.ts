// @vitest-environment jsdom
import { fireEvent, getByRole, getByText } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PreviewView } from './views/PreviewView.js';
import { PreviewError } from './errors.js';
import { LIGHTING_PRESETS, SphereViewer } from './widgets/SphereViewer.js';
import type { MaterialEntry } from '../db/types.js';

const mockEntry1: MaterialEntry = {
  key: 'cyberpunk/wall/poor',
  alignment: 'tile',
  tiling: { worldSize: [3, 3] },
  physical: {
    roughnessFactor: 0.85,
    metallicFactor: 0.1,
    breakable: false,
    alphaMode: 'OPAQUE',
  },
  variants: [
    {
      id: '1',
      resolution: [1024, 1024],
      maps: {
        basecolor: 'assets/wall/poor/1/basecolor.png',
        normal: 'assets/wall/poor/1/normal.png',
        roughness: 'assets/wall/poor/1/roughness.png',
        metallic: 'assets/wall/poor/1/metallic.png',
      },
    },
    {
      id: '2',
      resolution: [1024, 1024],
      maps: {
        basecolor: 'assets/wall/poor/2/basecolor.png',
        normal: 'assets/wall/poor/2/normal.png',
        roughness: 'assets/wall/poor/2/roughness.png',
        metallic: 'assets/wall/poor/2/metallic.png',
      },
    },
  ],
};

const mockEntry2: MaterialEntry = {
  key: 'cyberpunk/door/rich',
  alignment: 'exact',
  physical: {
    roughnessFactor: 0.3,
    metallicFactor: 0.9,
    tint: '#gold',
  },
  finish: {
    roughness: [0.1, 0.4],
    grain: 0.05,
    relief: 0.8,
  },
  variants: [
    {
      id: 'alpha',
      resolution: [2048, 2048],
      maps: {
        basecolor: 'assets/door/rich/alpha/basecolor.png',
        normal: 'assets/door/rich/alpha/normal.png',
        roughness: 'assets/door/rich/alpha/roughness.png',
        metallic: 'assets/door/rich/alpha/metallic.png',
        ao: 'assets/door/rich/alpha/ao.png',
        opacity: 'assets/door/rich/alpha/opacity.png',
        emission: 'assets/door/rich/alpha/emission.png',
      },
    },
  ],
};

function fetcherFor(themes: string[], themeIndexes: Record<string, unknown>): typeof fetch {
  return (async (url: string) => {
    const theme = themes.find((candidate) => url === `/themes/${candidate}/theme.json`);
    const body = url === '/api/themes' ? themes : theme ? themeIndexes[theme] : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('UI Polish Suite', () => {
  it('supports theme, kind, tier filtering and search in MaterialList', async () => {
    const viewer = {
      load: vi.fn(),
      canvas: document.createElement('canvas'),
      setLightingPreset: vi.fn(),
      setBackgroundMode: vi.fn(),
      toggleAutoRotate: vi.fn().mockReturnValue(true),
      toggleWireframe: vi.fn().mockReturnValue(true),
      resetCamera: vi.fn(),
      resize: vi.fn(),
    } as unknown as SphereViewer;

    const view = new PreviewView(viewer);
    const mockFetcher = fetcherFor(['cyberpunk'], {
      cyberpunk: {
        theme: 'cyberpunk',
        entries: {
          [mockEntry1.key]: mockEntry1,
          [mockEntry2.key]: mockEntry2,
        },
      },
    });

    await view.list.load(mockFetcher);

    // Both items should be present
    expect(getByText(view.root, 'cyberpunk/wall/poor')).toBeTruthy();
    expect(getByText(view.root, 'cyberpunk/door/rich')).toBeTruthy();

    const searchInput = getByRole(view.root, 'searchbox', { name: 'Search materials' });
    fireEvent.input(searchInput, { target: { value: 'door' } });
    expect(view.root.querySelector('[data-key="cyberpunk/door/rich"]')).toBeTruthy();
    expect(view.root.querySelector('[data-key="cyberpunk/wall/poor"]')).toBeNull();

    fireEvent.input(searchInput, { target: { value: 'nonexistent' } });
    expect(getByText(view.root, /No materials match current filters/)).toBeTruthy();

    fireEvent.input(searchInput, { target: { value: '' } });
    expect(getByText(view.root, 'cyberpunk/wall/poor')).toBeTruthy();
  });

  it('reports database loading failures through the closed preview error', async () => {
    const view = new PreviewView();
    const fetcher = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;

    await expect(view.list.load(fetcher)).rejects.toEqual(
      expect.objectContaining<Partial<PreviewError>>({ code: 'E_DATABASE_UNAVAILABLE' }),
    );
  });

  it('updates preview lighting presets and background modes in SphereViewer', () => {
    const viewer = {
      load: vi.fn(),
      canvas: document.createElement('canvas'),
      setLightingPreset: vi.fn(),
      setBackgroundMode: vi.fn(),
      toggleAutoRotate: vi.fn().mockReturnValue(true),
      toggleWireframe: vi.fn().mockReturnValue(true),
      resetCamera: vi.fn(),
      resize: vi.fn(),
    } as unknown as SphereViewer;

    const view = new PreviewView(viewer);

    const lightingSelect = getByRole(view.root, 'combobox', { name: 'lighting preset' });
    fireEvent.change(lightingSelect, { target: { value: 'neon' } });
    expect(viewer.setLightingPreset).toHaveBeenCalledWith('neon');

    const bgSelect = getByRole(view.root, 'combobox', { name: 'background mode' });
    fireEvent.change(bgSelect, { target: { value: 'grid' } });
    expect(viewer.setBackgroundMode).toHaveBeenCalledWith('grid');

    const spinBtn = getByRole(view.root, 'button', { name: 'Toggle spin' });
    fireEvent.click(spinBtn);
    expect(viewer.toggleAutoRotate).toHaveBeenCalled();

    const wireBtn = getByRole(view.root, 'button', { name: 'Toggle wireframe' });
    fireEvent.click(wireBtn);
    expect(viewer.toggleWireframe).toHaveBeenCalled();

    const resetCamBtn = getByRole(view.root, 'button', { name: 'Reset camera' });
    fireEvent.click(resetCamBtn);
    expect(viewer.resetCamera).toHaveBeenCalled();
  });

  it('renders rich PBR specs in MaterialInspector when material is selected', async () => {
    const viewer = {
      load: vi.fn(),
      canvas: document.createElement('canvas'),
      setLightingPreset: vi.fn(),
      setBackgroundMode: vi.fn(),
      toggleAutoRotate: vi.fn(),
      toggleWireframe: vi.fn(),
      resetCamera: vi.fn(),
      resize: vi.fn(),
    } as unknown as SphereViewer;

    const view = new PreviewView(viewer);
    const mockFetcher = fetcherFor(['cyberpunk'], {
      cyberpunk: {
        theme: 'cyberpunk',
        entries: {
          [mockEntry2.key]: mockEntry2,
        },
      },
    });

    await view.list.load(mockFetcher);
    fireEvent.click(getByText(view.root, 'cyberpunk/door/rich'));

    // Inspector should show authored finish specs and active channels
    expect(getByText(view.root, 'AUTHORED FINISH SPEC')).toBeTruthy();
    expect(getByText(view.root, 'PHYSICAL PBR PROPERTIES')).toBeTruthy();
    expect(getByText(view.root, 'TEXTURE CHANNELS (VARIANT alpha)')).toBeTruthy();
    expect(getByText(view.root, 'Opacity')).toBeTruthy();
    expect(view.root.querySelectorAll('img.channel-thumb').length).toBeGreaterThan(0);
    expect(getByRole(view.root, 'button', { name: 'Export material' })).toBeTruthy();
  });

  it('verifies lighting presets definition', () => {
    expect(LIGHTING_PRESETS.studio).toBeDefined();
    expect(LIGHTING_PRESETS.neon).toBeDefined();
    expect(LIGHTING_PRESETS.sunset).toBeDefined();
    expect(LIGHTING_PRESETS.lab).toBeDefined();
    expect(LIGHTING_PRESETS.dramatic).toBeDefined();
    expect(LIGHTING_PRESETS.overhead).toBeDefined();
  });
});
