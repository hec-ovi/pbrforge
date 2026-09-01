import { el } from './el.js';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number;
}

/** Lightweight technical toast notification manager. */
export class ToastManager {
  private container: HTMLElement;

  constructor() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = el('div', { id: 'toast-container', class: 'toast-container', 'aria-live': 'polite' });
      document.body.append(container);
    }
    this.container = container;
  }

  show(options: ToastOptions | string, type: ToastType = 'info', duration = 3200): HTMLElement {
    const config: ToastOptions = typeof options === 'string' ? { title: options, type, duration } : options;
    const toastType = config.type ?? type;
    const toastDuration = config.duration ?? duration;

    const iconSymbol = toastType === 'success' ? '✓' : toastType === 'error' ? '✕' : toastType === 'warning' ? '⚠' : 'ℹ';
    const closeBtn = el('button', { class: 'toast-close', type: 'button', 'aria-label': 'Dismiss' }, ['✕']);
    const children: (HTMLElement | string)[] = [
      el('span', { class: 'toast-icon' }, [iconSymbol]),
      el('div', { class: 'toast-content' }, [
        el('div', { class: 'toast-title' }, [config.title]),
        ...(config.message ? [el('div', { class: 'toast-message' }, [config.message])] : []),
      ]),
      closeBtn,
    ];

    const toastEl = el('div', { class: `toast toast-${toastType}`, role: 'status' }, children);
    this.container.append(toastEl);

    let isDismissed = false;
    const dismiss = () => {
      if (isDismissed) return;
      isDismissed = true;
      toastEl.classList.add('toast-exit');
      setTimeout(() => toastEl.remove(), 160);
    };

    closeBtn.addEventListener('click', () => dismiss());

    if (toastDuration > 0) {
      setTimeout(() => dismiss(), toastDuration);
    }

    return toastEl;
  }

  info(title: string, message?: string, duration?: number): HTMLElement {
    return this.show({ title, message, type: 'info', duration });
  }

  success(title: string, message?: string, duration?: number): HTMLElement {
    return this.show({ title, message, type: 'success', duration });
  }

  warning(title: string, message?: string, duration?: number): HTMLElement {
    return this.show({ title, message, type: 'warning', duration });
  }

  error(title: string, message?: string, duration?: number): HTMLElement {
    return this.show({ title, message, type: 'error', duration });
  }
}

export const toast = new ToastManager();
