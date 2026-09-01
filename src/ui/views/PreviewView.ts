import { el } from '../components/el.js';
import { MaterialList, type Selection } from '../widgets/MaterialList.js';
import type { SphereViewer } from '../widgets/SphereViewer.js';

/** Layout: material list sidebar, sphere stage, variant and repeat controls. */
export class PreviewView {
  readonly root = el('div', { class: 'preview' });
  readonly list: MaterialList;
  private variantSelect = el('select', { 'aria-label': 'variant' });
  private repeatSelect = el('select', { 'aria-label': 'repeat' });
  private selection?: Selection;

  constructor(private viewer?: SphereViewer) {
    this.list = new MaterialList((selection) => this.show(selection));
    for (const n of [1, 2, 3, 4]) this.repeatSelect.append(el('option', { value: String(n) }, [`${n}x${n}`]));
    this.repeatSelect.value = '2';
    this.variantSelect.addEventListener('change', () => this.render());
    this.repeatSelect.addEventListener('change', () => this.render());

    const stage = el('div', { class: 'stage' });
    if (viewer) stage.append(viewer.canvas);
    stage.append(
      el('div', { class: 'controls' }, [
        el('label', {}, ['variant']),
        this.variantSelect,
        el('label', {}, ['repeat']),
        this.repeatSelect,
      ]),
    );
    this.root.append(el('aside', { class: 'sidebar' }, [el('h1', {}, ['materials']), this.list.root]), stage);
  }

  private show(selection: Selection): void {
    this.selection = selection;
    this.variantSelect.replaceChildren();
    selection.entry.variants.forEach((variant, i) =>
      this.variantSelect.append(el('option', { value: String(i) }, [variant.id])),
    );
    this.render();
  }

  private render(): void {
    if (!this.selection) return;
    this.viewer?.load(
      this.selection.theme,
      this.selection.entry,
      Number(this.variantSelect.value || 0),
      Number(this.repeatSelect.value),
    );
  }
}
