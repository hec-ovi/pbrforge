import { el } from './el.js';
import { createSquareButton, createBadge } from '../ui/elements.js';
import type { MaterialEntry } from '../../db/types.js';

export interface InspectorState {
  theme: string;
  entry: MaterialEntry;
  variantIndex: number;
}

export class MaterialInspector {
  readonly root: HTMLElement;
  private content: HTMLElement;
  private isOpen = true;
  private currentState?: InspectorState;
  private mapViewer?: HTMLElement;
  private mapKeyHandler?: (event: KeyboardEvent) => void;

  constructor(private onClose?: () => void, tag = 'SPEC', title = 'TELEMETRY') {
    this.content = el('div', { class: 'inspector-content' });
    const copyJsonBtn = createSquareButton({
      label: '{ }',
      variant: 'secondary',
      size: 'sm',
      title: 'Copy JSON',
      ariaLabel: 'Copy JSON',
      onClick: () => {
        if (!this.currentState) return;
        void navigator.clipboard.writeText(JSON.stringify(this.currentState.entry, null, 2));
      },
    });
    copyJsonBtn.className = 'btn btn-icon btn-sm';

    const exportBtn = createSquareButton({
      label: 'EXPORT',
      variant: 'secondary',
      size: 'sm',
      title: 'Download this variant\'s maps',
      ariaLabel: 'Export material',
      onClick: () => {
        void this.exportCurrent();
      },
    });
    exportBtn.className = 'btn btn-sm';

    const closeBtn = createSquareButton({
      label: '✕',
      variant: 'secondary',
      size: 'sm',
      title: 'Close Inspector',
      ariaLabel: 'Close',
      onClick: () => {
        this.closeMap();
        this.toggle(false);
        this.onClose?.();
      },
    });
    closeBtn.className = 'btn btn-icon btn-sm';

    this.root = el('aside', { class: 'inspector-panel open', 'aria-label': 'Material Inspector' }, [
      el('div', { class: 'inspector-header' }, [
        el('div', { class: 'inspector-title-group' }, [
          createBadge(tag, 'inspector-tag'),
          el('h2', { class: 'inspector-title' }, [title]),
        ]),
        el('div', { class: 'inspector-actions' }, [exportBtn, copyJsonBtn, closeBtn]),
      ]),
      this.content,
    ]);

    this.renderEmpty();
  }

  toggle(open?: boolean): boolean {
    this.isOpen = open !== undefined ? open : !this.isOpen;
    if (this.isOpen) {
      this.root.classList.add('open');
    } else {
      this.root.classList.remove('open');
    }
    return this.isOpen;
  }

  get visible(): boolean {
    return this.isOpen;
  }

  update(theme: string, entry: MaterialEntry, variantIndex = 0): void {
    this.closeMap();
    this.currentState = { theme, entry, variantIndex };
    this.render(theme, entry, variantIndex);
  }

  private renderEmpty(): void {
    this.content.replaceChildren(
      el('div', { class: 'inspector-empty' }, [
        el('p', {}, ['Select a material from the list to view PBR channels and physical specs.']),
      ]),
    );
  }

  private render(theme: string, entry: MaterialEntry, variantIndex: number): void {
    const parts = entry.key.split('/');
    const kind = parts[1] || 'generic';
    const tier = parts[2] || 'standard';
    const variant = entry.variants[Math.min(variantIndex, entry.variants.length - 1)];
    const physical = entry.physical || {};
    const finish = entry.finish;

    const channelRows: HTMLElement[] = [];
    const channelNames: { name: string; key: keyof typeof variant.maps }[] = [
      { name: 'BaseColor', key: 'basecolor' },
      { name: 'Normal', key: 'normal' },
      { name: 'Roughness', key: 'roughness' },
      { name: 'Metallic', key: 'metallic' },
      { name: 'AO', key: 'ao' },
      { name: 'Height', key: 'height' },
      { name: 'Opacity', key: 'opacity' },
      { name: 'Emission', key: 'emission' },
      { name: 'Packed', key: 'metallicRoughness' },
    ];

    for (const ch of channelNames) {
      const path = variant.maps[ch.key];
      if (!path) continue;
      const url = `/themes/${theme}/${path}`;
      const row = el('button', {
        type: 'button',
        class: 'channel-item active',
        title: url,
        'aria-label': `View ${ch.name} full size`,
      }, [
        el('img', {
          class: 'channel-thumb',
          src: url,
          alt: '',
          width: '32',
          height: '32',
        }),
        el('span', { class: 'channel-name' }, [ch.name]),
      ]);
      row.addEventListener('click', () => this.openMap(ch.name, url));
      channelRows.push(row);
    }

    const tilingText = entry.tiling?.worldSize ? `${entry.tiling.worldSize[0]}m × ${entry.tiling.worldSize[1]}m` : 'None';
    const aspectText = entry.aspect ? `${entry.aspect[0]}:${entry.aspect[1]}` : '1:1';
    const resText = variant.resolution ? `${variant.resolution[0]} × ${variant.resolution[1]} px` : 'Unspecified';

    const copyBtn = createSquareButton({
      label: 'Copy',
      variant: 'secondary',
      size: 'sm',
      title: 'Copy Key',
      onClick: () => {
        void navigator.clipboard.writeText(entry.key);
      },
    });

    this.content.replaceChildren(
      // Material Key & Quick Copy
      el('div', { class: 'inspector-section' }, [
        el('div', { class: 'inspector-section-label' }, ['IDENTIFIER']),
        el('div', { class: 'inspector-key-box' }, [
          el('span', { class: 'inspector-key-text' }, [entry.key]),
          copyBtn,
        ]),
        el('div', { class: 'badge-row' }, [
          createBadge(theme, 'badge-theme'),
          createBadge(kind, 'badge-kind'),
          createBadge(tier, `badge-tier-${tier}`),
          createBadge(entry.alignment.toUpperCase(), `badge-${entry.alignment}`),
        ]),
      ]),

      // Dimensions & Tiling
      el('div', { class: 'inspector-section' }, [
        el('div', { class: 'inspector-section-label' }, ['SURFACE TILING']),
        el('div', { class: 'telemetry-grid' }, [
          el('div', { class: 'metric-card' }, [
            el('span', { class: 'metric-label' }, ['ALIGNMENT']),
            el('span', { class: 'metric-val' }, [entry.alignment]),
          ]),
          el('div', { class: 'metric-card' }, [
            el('span', { class: 'metric-label' }, ['WORLD TILE']),
            el('span', { class: 'metric-val' }, [tilingText]),
          ]),
          el('div', { class: 'metric-card' }, [
            el('span', { class: 'metric-label' }, ['ASPECT']),
            el('span', { class: 'metric-val' }, [aspectText]),
          ]),
          el('div', { class: 'metric-card' }, [
            el('span', { class: 'metric-label' }, ['RESOLUTION']),
            el('span', { class: 'metric-val' }, [resText]),
          ]),
        ]),
      ]),

      // Physical Parameters
      el('div', { class: 'inspector-section' }, [
        el('div', { class: 'inspector-section-label' }, ['PHYSICAL PBR PROPERTIES']),
        el('div', { class: 'param-rows' }, [
          this.renderParamRow('Roughness Factor', physical.roughnessFactor ?? 1.0, 0, 1),
          this.renderParamRow('Metallic Factor', physical.metallicFactor ?? 0.0, 0, 1),
          this.renderParamRow('Transmission', physical.transmission ?? 0.0, 0, 1),
          this.renderParamRow('IOR (Index of Refraction)', physical.ior ?? 1.5, 1, 3),
          this.renderParamRow('Emissive Intensity', physical.emissiveStrength ?? 0.0, 0, 10),
          el('div', { class: 'param-row-info' }, [
            el('span', { class: 'param-label' }, ['Alpha Mode']),
            createBadge(physical.alphaMode ?? 'OPAQUE', 'param-badge'),
          ]),
          el('div', { class: 'param-row-info' }, [
            el('span', { class: 'param-label' }, ['Breakable']),
            createBadge(physical.breakable ? 'YES' : 'NO', 'param-badge'),
          ]),
          ...(physical.tint
            ? [
                el('div', { class: 'param-row-info' }, [
                  el('span', { class: 'param-label' }, ['Physical Tint']),
                  el('span', { class: 'param-badge color-swatch', style: `background: ${physical.tint};` }, [
                    physical.tint,
                  ]),
                ]),
              ]
            : []),
        ]),
      ]),

      // Authored Finish
      ...(finish
        ? [
            el('div', { class: 'inspector-section' }, [
              el('div', { class: 'inspector-section-label' }, ['AUTHORED FINISH SPEC']),
              el('div', { class: 'telemetry-grid' }, [
                el('div', { class: 'metric-card' }, [
                  el('span', { class: 'metric-label' }, ['ROUGHNESS BAND']),
                  el('span', { class: 'metric-val' }, [`[${finish.roughness[0]}, ${finish.roughness[1]}]`]),
                ]),
                el('div', { class: 'metric-card' }, [
                  el('span', { class: 'metric-label' }, ['GRAIN']),
                  el('span', { class: 'metric-val' }, [finish.grain.toFixed(2)]),
                ]),
                el('div', { class: 'metric-card' }, [
                  el('span', { class: 'metric-label' }, ['RELIEF']),
                  el('span', { class: 'metric-val' }, [finish.relief.toFixed(2)]),
                ]),
              ]),
            ]),
          ]
        : []),

      // Texture Channels
      el('div', { class: 'inspector-section' }, [
        el('div', { class: 'inspector-section-label' }, [
          `TEXTURE CHANNELS (VARIANT ${variant.id})`,
        ]),
        el('div', { class: 'channel-list' }, channelRows),
      ]),
    );
  }

  private renderParamRow(label: string, value: number, min: number, max: number): HTMLElement {
    const percent = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
    return el('div', { class: 'param-row' }, [
      el('div', { class: 'param-meta' }, [
        el('span', { class: 'param-label' }, [label]),
        el('span', { class: 'param-val' }, [value.toFixed(2)]),
      ]),
      el('div', { class: 'param-meter-bg' }, [
        el('div', { class: 'param-meter-bar', style: `width: ${percent}%;` }),
      ]),
    ]);
  }

  private async exportCurrent(): Promise<void> {
    if (!this.currentState) return;
    const { theme, entry, variantIndex } = this.currentState;
    const variant = entry.variants[Math.min(variantIndex, entry.variants.length - 1)];
    if (!variant) return;
    const slug = entry.key.replaceAll('/', '-');
    downloadBlob(new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' }), `${slug}.json`);
    for (const [name, rel] of Object.entries(variant.maps)) {
      if (!rel) continue;
      const res = await fetch(`/themes/${theme}/${rel}`);
      if (!res.ok) continue;
      downloadBlob(await res.blob(), `${slug}-${name}.png`);
    }
  }

  private openMap(name: string, url: string): void {
    this.closeMap();
    const closeBtn = createSquareButton({
      label: '✕',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: 'Close map',
      onClick: () => this.closeMap(),
    });
    closeBtn.className = 'btn btn-icon btn-sm';
    const overlay = el('div', { class: 'map-viewer', role: 'dialog', 'aria-label': name }, [
      el('div', { class: 'map-viewer-bar' }, [
        el('span', { class: 'map-viewer-title' }, [name]),
        closeBtn,
      ]),
      el('img', { class: 'map-viewer-img', src: url, alt: name }),
    ]);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeMap();
    });
    this.mapKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeMap();
    };
    window.addEventListener('keydown', this.mapKeyHandler);
    document.body.append(overlay);
    this.mapViewer = overlay;
  }

  private closeMap(): void {
    this.mapViewer?.remove();
    this.mapViewer = undefined;
    if (this.mapKeyHandler) {
      window.removeEventListener('keydown', this.mapKeyHandler);
      this.mapKeyHandler = undefined;
    }
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
