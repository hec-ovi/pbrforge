import { el } from '../components/el.js';
import { toast } from '../components/Toast.js';
import type { MaterialEntry } from '../../db/types.js';

export interface InspectorState {
  theme: string;
  entry: MaterialEntry;
  variantIndex: number;
}

/** Side drawer / panel inspecting PBR telemetry, texture channels, and physics properties. */
export class MaterialInspector {
  readonly root: HTMLElement;
  private content: HTMLElement;
  private isOpen = true;
  private currentState?: InspectorState;

  constructor(private onClose?: () => void) {
    this.content = el('div', { class: 'inspector-content' });
    this.root = el('aside', { class: 'inspector-panel open', 'aria-label': 'Material Inspector' }, [
      el('div', { class: 'inspector-header' }, [
        el('div', { class: 'inspector-title-group' }, [
          el('span', { class: 'inspector-tag' }, ['SPEC']),
          el('h2', { class: 'inspector-title' }, ['TELEMETRY']),
        ]),
        el('div', { class: 'inspector-actions' }, [
          el('button', { class: 'btn btn-icon btn-sm', type: 'button', title: 'Copy JSON', 'aria-label': 'Copy JSON' }, ['{ }']),
          el('button', { class: 'btn btn-icon btn-sm', type: 'button', title: 'Close Inspector', 'aria-label': 'Close' }, ['✕']),
        ]),
      ]),
      this.content,
    ]);

    const actions = this.root.querySelectorAll<HTMLButtonElement>('.inspector-actions button');
    const copyJsonBtn = actions[0];
    const closeBtn = actions[1];

    copyJsonBtn.addEventListener('click', () => {
      if (!this.currentState) return;
      void navigator.clipboard.writeText(JSON.stringify(this.currentState.entry, null, 2));
      toast.success('Material JSON copied', this.currentState.entry.key);
    });

    closeBtn.addEventListener('click', () => {
      this.toggle(false);
      this.onClose?.();
    });

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
    const standardChannels: { name: string; key: keyof typeof variant.maps; label: string }[] = [
      { name: 'BaseColor', key: 'basecolor', label: 'DIFFUSE / ALBEDO' },
      { name: 'Normal', key: 'normal', label: 'TANGENT NORMAL' },
      { name: 'Roughness', key: 'roughness', label: 'MICRO-SURFACE' },
      { name: 'Metallic', key: 'metallic', label: 'CONDUCTIVITY' },
      { name: 'AO', key: 'ao', label: 'AMBIENT OCCLUSION' },
      { name: 'Displacement', key: 'height', label: 'HEIGHT / RELIEF' },
      { name: 'Emission', key: 'emission', label: 'SELF-ILLUMINATION' },
    ];

    for (const ch of standardChannels) {
      const path = variant.maps[ch.key];
      const active = Boolean(path);
      channelRows.push(
        el('div', { class: `channel-item ${active ? 'active' : 'inactive'}` }, [
          el('div', { class: 'channel-header' }, [
            el('span', { class: `channel-badge ${active ? 'badge-on' : 'badge-off'}` }, [active ? 'ACTIVE' : 'OFF']),
            el('span', { class: 'channel-name' }, [ch.name]),
            el('span', { class: 'channel-desc' }, [ch.label]),
          ]),
          el('div', { class: 'channel-path', title: path || 'Not authored' }, [path ? `/themes/${theme}/${path}` : '—']),
        ]),
      );
    }

    const tilingText = entry.tiling?.worldSize ? `${entry.tiling.worldSize[0]}m × ${entry.tiling.worldSize[1]}m` : 'None';
    const aspectText = entry.aspect ? `${entry.aspect[0]}:${entry.aspect[1]}` : '1:1';
    const resText = variant.resolution ? `${variant.resolution[0]} × ${variant.resolution[1]} px` : 'Unspecified';

    this.content.replaceChildren(
      // Material Key & Quick Copy
      el('div', { class: 'inspector-section' }, [
        el('div', { class: 'inspector-section-label' }, ['IDENTIFIER']),
        el('div', { class: 'inspector-key-box' }, [
          el('span', { class: 'inspector-key-text' }, [entry.key]),
          el(
            'button',
            { class: 'btn btn-secondary btn-sm', type: 'button', title: 'Copy Key' },
            ['Copy'],
          ),
        ]),
        el('div', { class: 'badge-row' }, [
          el('span', { class: 'badge badge-theme' }, [theme]),
          el('span', { class: 'badge badge-kind' }, [kind]),
          el('span', { class: `badge badge-tier-${tier}` }, [tier]),
          el('span', { class: `badge badge-${entry.alignment}` }, [entry.alignment.toUpperCase()]),
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
            el('span', { class: 'param-badge' }, [physical.alphaMode ?? 'OPAQUE']),
          ]),
          el('div', { class: 'param-row-info' }, [
            el('span', { class: 'param-label' }, ['Breakable']),
            el('span', { class: 'param-badge' }, [physical.breakable ? 'YES' : 'NO']),
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

    const copyBtn = this.content.querySelector<HTMLButtonElement>('.inspector-key-box button');
    copyBtn?.addEventListener('click', () => {
      void navigator.clipboard.writeText(entry.key);
      toast.success('Material key copied', entry.key);
    });
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
}
