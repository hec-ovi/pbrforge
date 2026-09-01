import { el } from '../components/el.js';
import type { MaterialEntry, ThemeIndex } from '../../db/types.js';

export interface Selection {
  theme: string;
  entry: MaterialEntry;
}

/** Sidebar list of every key in the database; emits the selected entry. */
export class MaterialList {
  readonly root = el('nav', { class: 'material-list', 'aria-label': 'materials' });
  private active?: HTMLButtonElement;

  constructor(private onSelect: (selection: Selection) => void) {}

  async load(fetcher: typeof fetch = fetch): Promise<void> {
    const themes = (await (await fetcher('/api/themes')).json()) as string[];
    const rows: { theme: string; entry: MaterialEntry }[] = [];
    for (const theme of themes) {
      const index = (await (await fetcher(`/themes/${theme}/theme.json`)).json()) as ThemeIndex;
      for (const key of Object.keys(index.entries).sort()) rows.push({ theme, entry: index.entries[key] });
    }
    this.root.replaceChildren();
    if (rows.length === 0) {
      this.root.append(el('p', { class: 'empty' }, ['database is empty, create a material first']));
      return;
    }
    for (const row of rows) {
      const button = el('button', { type: 'button' }, [row.entry.key]);
      button.addEventListener('click', () => {
        this.active?.classList.remove('active');
        button.classList.add('active');
        this.active = button;
        this.onSelect(row);
      });
      this.root.append(button);
    }
  }
}
