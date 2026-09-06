/** Small primitive UI units coded once with strict square corners and zero business logic. */

export function createSquareButton(options: {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'xs' | 'sm' | 'md';
  ariaLabel?: string;
  title?: string;
  active?: boolean;
  onClick?: (event: MouseEvent) => void;
}): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  const variant = options.variant ?? 'secondary';
  const size = options.size ?? 'sm';
  btn.className = `ui-btn ui-btn-${variant} ui-btn-${size}${options.active ? ' active' : ''}`;
  btn.textContent = options.label;
  if (options.ariaLabel) btn.setAttribute('aria-label', options.ariaLabel);
  if (options.title) btn.title = options.title;
  if (options.onClick) btn.addEventListener('click', options.onClick);
  return btn;
}

export function createSquareSelect(options: {
  ariaLabel?: string;
  size?: 'sm' | 'md';
  options?: { value: string; label: string }[];
  onChange?: (val: string) => void;
}): HTMLSelectElement {
  const select = document.createElement('select');
  const size = options.size ?? 'sm';
  select.className = `ui-select ui-select-${size}`;
  if (options.ariaLabel) select.setAttribute('aria-label', options.ariaLabel);
  if (options.options) {
    for (const opt of options.options) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      select.append(el);
    }
  }
  if (options.onChange) {
    select.addEventListener('change', () => options.onChange!(select.value));
  }
  return select;
}

export function createSquareInput(options: {
  type?: string;
  placeholder?: string;
  ariaLabel?: string;
  onInput?: (val: string) => void;
}): HTMLInputElement {
  const input = document.createElement('input');
  input.type = options.type ?? 'text';
  input.className = 'ui-input';
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.ariaLabel) input.setAttribute('aria-label', options.ariaLabel);
  if (options.onInput) {
    input.addEventListener('input', () => options.onInput!(input.value));
  }
  return input;
}

export function createBadge(label: string, kindClass?: string): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = `ui-badge ${kindClass || ''}`.trim();
  badge.textContent = label;
  return badge;
}
