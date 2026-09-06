import { el } from './el.js';
import { createSquareButton } from '../ui/elements.js';

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 64;
const ZOOM_STEP = 1.25;
const WHEEL_STEP = 1.1;

export interface MapChannel {
  name: string;
  url: string;
}

/** Full-size map preview: wheel zoom, drag pan, FIT and 100%. */
export class MapViewer {
  private root?: HTMLElement;
  private stage?: HTMLElement;
  private img?: HTMLImageElement;
  private titleEl?: HTMLElement;
  private zoomLabel?: HTMLElement;
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private drag: { x: number; y: number } | undefined;
  private onKey?: (event: KeyboardEvent) => void;
  private onWheel?: (event: WheelEvent) => void;
  private onPointerDown?: (event: PointerEvent) => void;
  private onPointerMove?: (event: PointerEvent) => void;
  private onPointerUp?: (event: PointerEvent) => void;

  open(name: string, url: string, channels: MapChannel[] = []): void {
    if (this.root) {
      this.show(name, url);
      return;
    }

    const zoomOut = createSquareButton({
      label: '−',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: 'Zoom out',
      onClick: () => this.zoomCenter(1 / ZOOM_STEP),
    });
    zoomOut.className = 'btn btn-icon btn-sm';
    const zoomIn = createSquareButton({
      label: '+',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: 'Zoom in',
      onClick: () => this.zoomCenter(ZOOM_STEP),
    });
    zoomIn.className = 'btn btn-icon btn-sm';
    const fit = createSquareButton({
      label: 'FIT',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: 'Fit view',
      onClick: () => this.fit(),
    });
    fit.className = 'btn btn-sm';
    const actual = createSquareButton({
      label: '100%',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: 'Actual size',
      onClick: () => this.actual(),
    });
    actual.className = 'btn btn-sm';
    const closeBtn = createSquareButton({
      label: '✕',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: 'Close map',
      onClick: () => this.close(),
    });
    closeBtn.className = 'btn btn-icon btn-sm';

    this.zoomLabel = el('span', { class: 'map-viewer-zoom' }, ['100%']);
    this.titleEl = el('span', { class: 'map-viewer-title' }, [name]);
    this.img = el('img', { class: 'map-viewer-img', alt: name, draggable: 'false' }) as HTMLImageElement;
    this.stage = el('div', { class: 'map-viewer-stage' }, [this.img]);
    const strip = el('div', { class: 'map-viewer-strip' });
    for (const ch of channels) {
      const item = el('button', {
        type: 'button',
        class: 'map-viewer-strip-item',
        'data-name': ch.name,
        'aria-label': `Show ${ch.name}`,
      }, [
        el('img', { src: ch.url, alt: '', width: '48', height: '48' }),
        el('span', { class: 'map-viewer-strip-name' }, [ch.name]),
      ]);
      item.addEventListener('click', () => this.show(ch.name, ch.url));
      strip.append(item);
    }
    this.root = el('div', { class: 'map-viewer', role: 'dialog', 'aria-label': name }, [
      el('div', { class: 'map-viewer-bar' }, [
        this.titleEl,
        this.zoomLabel,
        el('div', { class: 'map-viewer-actions' }, [zoomOut, zoomIn, fit, actual, closeBtn]),
      ]),
      this.stage,
      strip,
    ]);

    this.onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.close();
      else if (event.key === '+' || event.key === '=') this.zoomCenter(ZOOM_STEP);
      else if (event.key === '-') this.zoomCenter(1 / ZOOM_STEP);
      else if (event.key === '0') this.fit();
      else if (event.key === '1') this.actual();
    };
    this.onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = this.stage!.getBoundingClientRect();
      this.zoomAt(
        event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    this.onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      this.drag = { x: event.clientX, y: event.clientY };
      this.stage!.classList.add('panning');
      this.stage!.setPointerCapture?.(event.pointerId);
    };
    this.onPointerMove = (event: PointerEvent) => {
      if (!this.drag) return;
      this.tx += event.clientX - this.drag.x;
      this.ty += event.clientY - this.drag.y;
      this.drag = { x: event.clientX, y: event.clientY };
      this.apply();
    };
    this.onPointerUp = (event: PointerEvent) => {
      this.drag = undefined;
      this.stage?.classList.remove('panning');
      this.stage?.releasePointerCapture?.(event.pointerId);
    };

    window.addEventListener('keydown', this.onKey);
    this.stage.addEventListener('wheel', this.onWheel, { passive: false });
    this.stage.addEventListener('pointerdown', this.onPointerDown);
    this.stage.addEventListener('pointermove', this.onPointerMove);
    this.stage.addEventListener('pointerup', this.onPointerUp);
    this.stage.addEventListener('pointercancel', this.onPointerUp);

    document.body.append(this.root);
    this.show(name, url);
  }

  private show(name: string, url: string): void {
    if (!this.root || !this.img || !this.titleEl) return;
    this.root.setAttribute('aria-label', name);
    this.titleEl.textContent = name;
    this.img.alt = name;
    this.img.addEventListener('load', () => this.fit(), { once: true });
    this.img.src = url;
    if (this.img.complete) this.fit();
    else this.apply();
    for (const item of Array.from(this.root.querySelectorAll('.map-viewer-strip-item'))) {
      item.classList.toggle('active', item.getAttribute('data-name') === name);
    }
  }

  close(): void {
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    if (this.stage && this.onWheel) this.stage.removeEventListener('wheel', this.onWheel);
    if (this.stage && this.onPointerDown) this.stage.removeEventListener('pointerdown', this.onPointerDown);
    if (this.stage && this.onPointerMove) this.stage.removeEventListener('pointermove', this.onPointerMove);
    if (this.stage && this.onPointerUp) {
      this.stage.removeEventListener('pointerup', this.onPointerUp);
      this.stage.removeEventListener('pointercancel', this.onPointerUp);
    }
    this.root?.remove();
    this.root = undefined;
    this.stage = undefined;
    this.img = undefined;
    this.titleEl = undefined;
    this.zoomLabel = undefined;
    this.onKey = undefined;
    this.onWheel = undefined;
    this.onPointerDown = undefined;
    this.onPointerMove = undefined;
    this.onPointerUp = undefined;
    this.drag = undefined;
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
  }

  private fit(): void {
    if (!this.stage || !this.img) return;
    const sw = this.stage.clientWidth;
    const sh = this.stage.clientHeight;
    const iw = this.img.naturalWidth || 1;
    const ih = this.img.naturalHeight || 1;
    if (sw <= 0 || sh <= 0) {
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
    } else {
      this.scale = Math.min(sw / iw, sh / ih);
      this.tx = (sw - iw * this.scale) / 2;
      this.ty = (sh - ih * this.scale) / 2;
    }
    this.apply();
  }

  private actual(): void {
    if (!this.stage || !this.img) return;
    const sw = this.stage.clientWidth;
    const sh = this.stage.clientHeight;
    const iw = this.img.naturalWidth || 1;
    const ih = this.img.naturalHeight || 1;
    this.scale = 1;
    this.tx = (sw - iw) / 2;
    this.ty = (sh - ih) / 2;
    this.apply();
  }

  private zoomCenter(factor: number): void {
    if (!this.stage) return;
    this.zoomAt(factor, this.stage.clientWidth / 2, this.stage.clientHeight / 2);
  }

  private zoomAt(factor: number, cx: number, cy: number): void {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.scale * factor));
    if (next === this.scale) return;
    this.tx = cx - (cx - this.tx) * (next / this.scale);
    this.ty = cy - (cy - this.ty) * (next / this.scale);
    this.scale = next;
    this.apply();
  }

  private apply(): void {
    if (!this.img) return;
    if (this.img.naturalWidth) {
      this.img.style.width = `${this.img.naturalWidth}px`;
      this.img.style.height = `${this.img.naturalHeight}px`;
    }
    this.img.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
    this.img.dataset.scale = String(this.scale);
    this.img.dataset.x = String(this.tx);
    this.img.dataset.y = String(this.ty);
    if (this.zoomLabel) this.zoomLabel.textContent = `${Math.round(this.scale * 100)}%`;
  }
}
