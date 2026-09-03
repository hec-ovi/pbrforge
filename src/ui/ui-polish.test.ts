// @vitest-environment jsdom
import { fireEvent, getByRole, getByText } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PreviewView } from './views/PreviewView.js';
import { toast } from './components/Toast.js';
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

    // Filter by kind: 'door'
    const kindSelect = getByRole(view.root, 'combobox', { name: 'Filter kind' });
    fireEvent.change(kindSelect, { target: { value: 'door' } });
    expect(view.root.querySelector('[data-key="cyberpunk/door/rich"]')).toBeTruthy();
    expect(view.root.querySelector('[data-key="cyberpunk/wall/poor"]')).toBeNull();

    // Filter by tier: 'rich'
    const tierSelect = getByRole(view.root, 'combobox', { name: 'Filter tier' });
    fireEvent.change(tierSelect, { target: { value: 'rich' } });
    expect(view.root.querySelector('[data-key="cyberpunk/door/rich"]')).toBeTruthy();

    // Search query
    const searchInput = getByRole(view.root, 'searchbox', { name: 'Search materials' });
    fireEvent.input(searchInput, { target: { value: 'nonexistent' } });
    expect(getByText(view.root, /No materials match current filters/)).toBeTruthy();

    // Reset search
    fireEvent.input(searchInput, { target: { value: '' } });
    fireEvent.change(kindSelect, { target: { value: 'all' } });
    fireEvent.change(tierSelect, { target: { value: 'all' } });
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
    expect(getByText(view.root, 'SURFACE COVERAGE')).toBeTruthy();
  });

  it('displays toast messages with various severities and dispatches properly', () => {
    const tInfo = toast.info('Info message', 'Detail info');
    expect(tInfo.classList.contains('toast-info')).toBe(true);

    const tSuccess = toast.success('Success message');
    expect(tSuccess.classList.contains('toast-success')).toBe(true);

    const tWarn = toast.warning('Warning message');
    expect(tWarn.classList.contains('toast-warning')).toBe(true);

    const tErr = toast.error('Error message');
    expect(tErr.classList.contains('toast-error')).toBe(true);
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
