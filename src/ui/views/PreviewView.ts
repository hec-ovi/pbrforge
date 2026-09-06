import { el } from '../components/el.js';
import { toast } from '../components/Toast.js';
import { MaterialInspector } from '../components/MaterialInspector.js';
import { MaterialList, type Selection } from '../components/MaterialList.js';
import { createSquareButton, createSquareSelect } from '../ui/elements.js';
import { LIGHTING_PRESETS, type LightingPresetKey, type SphereViewer, type BackgroundMode } from '../widgets/SphereViewer.js';
import layoutConfig from './preview-layout.json';

/** Complete PBR Material preview workspace with filtering, sphere stage, lighting presets, and telemetry. */
export class PreviewView {
  readonly root: HTMLElement;
  readonly list: MaterialList;
  readonly inspector: MaterialInspector;

  private variantSelect: HTMLSelectElement;
  private repeatSelect: HTMLSelectElement;
  private lightingSelect: HTMLSelectElement;
  private bgSelect: HTMLSelectElement;

  private spinBtn: HTMLButtonElement;
  private wireBtn: HTMLButtonElement;
  private resetCamBtn: HTMLButtonElement;
  private inspectorBtn: HTMLButtonElement;
  private copyKeyBtn: HTMLButtonElement;

  private breadcrumbText: HTMLElement;
  private telemetryStatus: HTMLElement;
  private stageElement: HTMLElement;
  private canvasWrapper: HTMLElement;
  private selection?: Selection;

  constructor(private viewer?: SphereViewer) {
    // Inspector & List initialised with layout configuration schema
    const inspectorCfg = layoutConfig.inspector;
    this.inspector = new MaterialInspector(() => {
      this.inspectorBtn.classList.remove('active');
    }, inspectorCfg.tag, inspectorCfg.title);

    const sidebarCfg = layoutConfig.sidebar;
    this.list = new MaterialList(
      (selection) => this.show(selection),
      sidebarCfg.tag,
      sidebarCfg.title,
      sidebarCfg.searchPlaceholder,
    );

    // Initialise UI controls from primitive square builders
    this.variantSelect = createSquareSelect({ ariaLabel: 'variant' });
    this.variantSelect.className = 'select-control';
    this.variantSelect.addEventListener('change', () => {
      this.render();
      if (this.selection) {
        toast.info(`Variant: ${this.variantSelect.options[this.variantSelect.selectedIndex]?.text || this.variantSelect.value}`);
      }
    });

    this.repeatSelect = createSquareSelect({ ariaLabel: 'repeat' });
    this.repeatSelect.className = 'select-control';
    for (const n of [1, 2, 3, 4]) {
      this.repeatSelect.append(el('option', { value: String(n) }, [`${n}x${n}`]));
    }
    this.repeatSelect.value = '2';
    this.repeatSelect.addEventListener('change', () => {
      this.render();
      toast.info(`Tiling Repeat: ${this.repeatSelect.value}×${this.repeatSelect.value}`);
    });

    this.lightingSelect = createSquareSelect({ ariaLabel: 'lighting preset' });
    this.lightingSelect.className = 'select-control';
    for (const [key, preset] of Object.entries(LIGHTING_PRESETS)) {
      this.lightingSelect.append(el('option', { value: key }, [preset.name.toUpperCase()]));
    }
    this.lightingSelect.value = 'studio';
    this.lightingSelect.addEventListener('change', () => {
      const presetKey = this.lightingSelect.value as LightingPresetKey;
      this.viewer?.setLightingPreset(presetKey);
      this.updateTelemetry();
      toast.info(`Lighting: ${LIGHTING_PRESETS[presetKey]?.name || presetKey}`);
    });

    this.bgSelect = createSquareSelect({ ariaLabel: 'background mode' });
    this.bgSelect.className = 'select-control';
    const bgModes: { id: BackgroundMode; label: string }[] = [
      { id: 'dark', label: 'DARK VOID' },
      { id: 'grid', label: 'CAD GRID' },
      { id: 'gray', label: 'STUDIO GRAY' },
      { id: 'void', label: 'OBSIDIAN' },
    ];
    for (const bg of bgModes) {
      this.bgSelect.append(el('option', { value: bg.id }, [bg.label]));
    }
    this.bgSelect.value = 'dark';
    this.bgSelect.addEventListener('change', () => {
      const bg = this.bgSelect.value as BackgroundMode;
      this.viewer?.setBackgroundMode(bg);
      if (bg === 'grid') {
        this.canvasWrapper.classList.add('bg-cad-grid');
      } else {
        this.canvasWrapper.classList.remove('bg-cad-grid');
      }
    });

    // Buttons
    this.spinBtn = createSquareButton({
      label: 'SPIN: OFF',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: 'Toggle spin',
      onClick: () => {
        const spinning = this.viewer?.toggleAutoRotate() ?? false;
        this.spinBtn.textContent = `SPIN: ${spinning ? 'ON' : 'OFF'}`;
        this.spinBtn.classList.toggle('active', spinning);
        this.updateTelemetry();
      },
    });
    this.spinBtn.className = 'btn btn-secondary btn-sm';

    this.wireBtn = createSquareButton({
      label: 'WIRE',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: 'Toggle wireframe',
      onClick: () => {
        const wire = this.viewer?.toggleWireframe() ?? false;
        this.wireBtn.classList.toggle('active', wire);
        toast.info(`Wireframe: ${wire ? 'ENABLED' : 'DISABLED'}`);
      },
    });
    this.wireBtn.className = 'btn btn-secondary btn-sm';

    this.resetCamBtn = createSquareButton({
      label: 'RESET CAM',
      variant: 'secondary',
      size: 'sm',
      title: 'Reset Camera Position',
      ariaLabel: 'Reset camera',
      onClick: () => {
        this.viewer?.resetCamera();
        toast.info('Camera reset to origin');
      },
    });
    this.resetCamBtn.className = 'btn btn-secondary btn-sm';

    this.inspectorBtn = createSquareButton({
      label: 'SPEC',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: 'Toggle inspector',
      active: true,
      onClick: () => {
        const open = this.inspector.toggle();
        this.inspectorBtn.classList.toggle('active', open);
      },
    });
    this.inspectorBtn.className = 'btn btn-secondary btn-sm active';

    this.copyKeyBtn = createSquareButton({
      label: 'COPY KEY',
      variant: 'ghost',
      size: 'xs',
      title: 'Copy Material Key',
      onClick: () => {
        if (!this.selection) return;
        void navigator.clipboard.writeText(this.selection.entry.key);
        toast.success('Copied material key', this.selection.entry.key);
      },
    });
    this.copyKeyBtn.className = 'btn btn-ghost btn-xs';

    this.breadcrumbText = el('span', { class: 'stage-breadcrumb-text' }, ['NO MATERIAL SELECTED']);
    this.telemetryStatus = el('div', { class: 'stage-status-text' }, [
      'LIGHT: STUDIO • REPEAT: 2×2 • SPIN: OFF • ORBIT: L-DRAG / ZOOM: SCROLL',
    ]);

    // Top Stage Controls Toolbar
    const toolbar = el('header', { class: 'stage-toolbar' }, [
      el('div', { class: 'stage-toolbar-left' }, [
        el('div', { class: 'stage-breadcrumb' }, [
          el('span', { class: 'stage-indicator-dot' }),
          this.breadcrumbText,
        ]),
        this.copyKeyBtn,
      ]),
      el('div', { class: 'stage-toolbar-right' }, [
        el('div', { class: 'control-group' }, [el('label', { class: 'control-label' }, ['LIGHT']), this.lightingSelect]),
        el('div', { class: 'control-group' }, [el('label', { class: 'control-label' }, ['REPEAT']), this.repeatSelect]),
        el('div', { class: 'control-group' }, [el('label', { class: 'control-label' }, ['VARIANT']), this.variantSelect]),
        el('div', { class: 'control-group' }, [el('label', { class: 'control-label' }, ['BG']), this.bgSelect]),
        this.spinBtn,
        this.wireBtn,
        this.resetCamBtn,
        this.inspectorBtn,
      ]),
    ]);

    // Stage HUD Overlays
    const stageHud = el('div', { class: 'stage-hud-overlay' }, [
      el('div', { class: 'hud-corner hud-top-left' }),
      el('div', { class: 'hud-corner hud-top-right' }),
      el('div', { class: 'hud-corner hud-bottom-left' }),
      el('div', { class: 'hud-corner hud-bottom-right' }),
      el('div', { class: 'hud-center-reticle' }),
    ]);

    // Footer Bar
    const stageFooter = el('footer', { class: 'stage-footer-bar' }, [
      this.telemetryStatus,
      el('div', { class: 'stage-credits' }, [layoutConfig.stage.footerTag]),
    ]);

    // Canvas container
    this.canvasWrapper = el('div', { class: 'stage-canvas-container' });
    if (viewer) {
      this.canvasWrapper.append(viewer.canvas);
    }

    this.stageElement = el('main', { class: 'stage' }, [
      toolbar,
      this.canvasWrapper,
      stageHud,
      stageFooter,
    ]);

    // Main workspace layout
    this.root = el('div', { class: 'preview-workspace' }, [
      el('aside', { class: 'sidebar' }, [this.list.root]),
      this.stageElement,
      this.inspector.root,
    ]);

    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this.viewer?.resize(width, height);
          }
        }
      });
      ro.observe(this.canvasWrapper);
    } else {
      window.addEventListener('resize', () => {
        const rect = this.canvasWrapper.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.viewer?.resize(rect.width, rect.height);
        }
      });
    }
  }

  private show(selection: Selection): void {
    this.selection = selection;
    this.variantSelect.replaceChildren();
    selection.entry.variants.forEach((variant, i) =>
      this.variantSelect.append(el('option', { value: String(i) }, [variant.id])),
    );

    this.breadcrumbText.textContent = selection.entry.key;
    this.render();
    toast.success('Loaded material', selection.entry.key);
  }

  private render(): void {
    if (!this.selection) return;
    const variantIndex = Number(this.variantSelect.value || 0);
    const repeat = Number(this.repeatSelect.value || 2);

    this.viewer?.load(
      this.selection.theme,
      this.selection.entry,
      variantIndex,
      repeat,
    );

    this.inspector.update(this.selection.theme, this.selection.entry, variantIndex);
    this.updateTelemetry();
  }

  private updateTelemetry(): void {
    const light = this.lightingSelect.options[this.lightingSelect.selectedIndex]?.text || 'STUDIO';
    const repeat = `${this.repeatSelect.value}×${this.repeatSelect.value}`;
    const spin = this.viewer?.isAutoRotating ? 'ON' : 'OFF';
    const variant = this.variantSelect.value || '0';
    const key = this.selection?.entry.key || 'NONE';

    this.telemetryStatus.textContent = `MAT: ${key} • VAR: ${variant} • LIGHT: ${light} • REPEAT: ${repeat} • SPIN: ${spin}`;
  }
}
