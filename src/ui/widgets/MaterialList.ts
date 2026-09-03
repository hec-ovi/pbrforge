import { el } from '../components/el.js';
import { PreviewError } from '../errors.js';
import type { MaterialEntry, ThemeIndex } from '../../db/types.js';

export interface Selection {
  theme: string;
  entry: MaterialEntry;
}

interface MaterialRow {
  theme: string;
  entry: MaterialEntry;
  kind: string;
  tier: string;
  button?: HTMLButtonElement;
}

/** Sidebar list of materials with search, theme/kind/tier filtering, and technical badges. */
export class MaterialList {
  readonly root: HTMLElement;
  private listContainer: HTMLElement;
  private searchInput: HTMLInputElement;
  private themeSelect: HTMLSelectElement;
  private kindSelect: HTMLSelectElement;
  private tierSelect: HTMLSelectElement;
  private countLabel: HTMLElement;

  private allRows: MaterialRow[] = [];
  private activeRow?: MaterialRow;
  private currentSearch = '';
  private currentTheme = 'all';
  private currentKind = 'all';
  private currentTier = 'all';

  constructor(private onSelect: (selection: Selection) => void) {
    this.searchInput = el('input', {
      type: 'search',
      class: 'input-search',
      placeholder: 'Filter key, kind, tier...',
      'aria-label': 'Search materials',
    }) as HTMLInputElement;

    this.themeSelect = el('select', { class: 'select-filter', 'aria-label': 'Filter theme' }) as HTMLSelectElement;
    this.kindSelect = el('select', { class: 'select-filter', 'aria-label': 'Filter kind' }) as HTMLSelectElement;
    this.tierSelect = el('select', { class: 'select-filter', 'aria-label': 'Filter tier' }) as HTMLSelectElement;

    this.countLabel = el('span', { class: 'list-count-badge' }, ['0 items']);
    this.listContainer = el('nav', { class: 'material-items-container', 'aria-label': 'materials' });

    const filterBar = el('div', { class: 'filter-bar' }, [
      el('div', { class: 'search-box' }, [this.searchInput]),
      el('div', { class: 'filter-selectors' }, [
        el('div', { class: 'filter-field' }, [el('label', {}, ['THEME']), this.themeSelect]),
        el('div', { class: 'filter-field' }, [el('label', {}, ['KIND']), this.kindSelect]),
        el('div', { class: 'filter-field' }, [el('label', {}, ['TIER']), this.tierSelect]),
      ]),
    ]);

    const header = el('div', { class: 'list-header' }, [
      el('div', { class: 'list-title-row' }, [
        el('span', { class: 'sidebar-tag' }, ['LIB']),
        el('h1', { class: 'sidebar-title' }, ['MATERIALS']),
        this.countLabel,
      ]),
      filterBar,
    ]);

    this.root = el('div', { class: 'material-list-widget' }, [header, this.listContainer]);

    this.searchInput.addEventListener('input', () => {
      this.currentSearch = this.searchInput.value.trim().toLowerCase();
      this.applyFilter();
    });

    this.themeSelect.addEventListener('change', () => {
      this.currentTheme = this.themeSelect.value;
      this.applyFilter();
    });

    this.kindSelect.addEventListener('change', () => {
      this.currentKind = this.kindSelect.value;
      this.applyFilter();
    });

    this.tierSelect.addEventListener('change', () => {
      this.currentTier = this.tierSelect.value;
      this.applyFilter();
    });
  }

  async load(fetcher: typeof fetch = fetch): Promise<void> {
    try {
      const themes = await readJson(fetcher, '/api/themes');
      if (!Array.isArray(themes) || themes.some((theme) => typeof theme !== 'string')) {
        throw new TypeError('theme list must be an array of strings');
      }
      const rows: MaterialRow[] = [];

      for (const theme of themes) {
        const index = await readJson(fetcher, `/themes/${theme}/theme.json`) as ThemeIndex;
        if (!index || typeof index !== 'object' || !index.entries || typeof index.entries !== 'object') {
          throw new TypeError(`theme index is invalid for ${theme}`);
        }
        for (const key of Object.keys(index.entries).sort()) {
          const entry = index.entries[key];
          const parts = key.split('/');
          const kind = parts[1] || 'generic';
          const tier = parts[2] || 'standard';
          rows.push({ theme, entry, kind, tier });
        }
      }

      this.allRows = rows;
      this.populateFilterDropdowns();
      this.applyFilter();
    } catch (cause) {
      throw new PreviewError('E_DATABASE_UNAVAILABLE', 'material database could not be loaded', cause);
    }
  }

  private populateFilterDropdowns(): void {
    const themes = new Set<string>();
    const kinds = new Set<string>();
    const tiers = new Set<string>();

    for (const row of this.allRows) {
      themes.add(row.theme);
      kinds.add(row.kind);
      tiers.add(row.tier);
    }

    this.themeSelect.replaceChildren(el('option', { value: 'all' }, ['ALL THEMES']));
    for (const t of Array.from(themes).sort()) {
      this.themeSelect.append(el('option', { value: t }, [t.toUpperCase()]));
    }

    this.kindSelect.replaceChildren(el('option', { value: 'all' }, ['ALL KINDS']));
    for (const k of Array.from(kinds).sort()) {
      this.kindSelect.append(el('option', { value: k }, [k.toUpperCase()]));
    }

    this.tierSelect.replaceChildren(el('option', { value: 'all' }, ['ALL TIERS']));
    for (const tr of Array.from(tiers).sort()) {
      this.tierSelect.append(el('option', { value: tr }, [tr.toUpperCase()]));
    }
  }

  private applyFilter(): void {
    this.listContainer.replaceChildren();

    if (this.allRows.length === 0) {
      this.countLabel.textContent = '0 items';
      this.listContainer.append(el('p', { class: 'empty' }, ['database is empty, create a material first']));
      return;
    }

    const filtered = this.allRows.filter((row) => {
      if (this.currentTheme !== 'all' && row.theme !== this.currentTheme) return false;
      if (this.currentKind !== 'all' && row.kind !== this.currentKind) return false;
      if (this.currentTier !== 'all' && row.tier !== this.currentTier) return false;
      if (this.currentSearch) {
        const matchKey = row.entry.key.toLowerCase().includes(this.currentSearch);
        const matchKind = row.kind.toLowerCase().includes(this.currentSearch);
        const matchTier = row.tier.toLowerCase().includes(this.currentSearch);
        if (!matchKey && !matchKind && !matchTier) return false;
      }
      return true;
    });

    this.countLabel.textContent = `${filtered.length} / ${this.allRows.length}`;

    if (filtered.length === 0) {
      const clearBtn = el('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, ['Reset filters']);
      clearBtn.addEventListener('click', () => {
        this.searchInput.value = '';
        this.currentSearch = '';
        this.themeSelect.value = 'all';
        this.currentTheme = 'all';
        this.kindSelect.value = 'all';
        this.currentKind = 'all';
        this.tierSelect.value = 'all';
        this.currentTier = 'all';
        this.applyFilter();
      });
      this.listContainer.append(
        el('div', { class: 'empty-filter-state' }, [
          el('p', { class: 'empty' }, ['No materials match current filters']),
          clearBtn,
        ]),
      );
      return;
    }

    for (const row of filtered) {
      const variantCount = row.entry.variants.length;
      const variantLabel = `${variantCount} var${variantCount > 1 ? 's' : ''}`;
      const button = el(
        'button',
        {
          type: 'button',
          class: `material-card ${this.activeRow === row ? 'active' : ''}`,
          'data-key': row.entry.key,
        },
        [
          el('div', { class: 'card-meta-row' }, [
            el('span', { class: 'badge badge-kind' }, [row.kind]),
            el('span', { class: `badge badge-tier-${row.tier}` }, [row.tier]),
            el('span', { class: `badge badge-${row.entry.alignment}` }, [row.entry.alignment.toUpperCase()]),
            el('span', { class: 'card-variants-count' }, [variantLabel]),
          ]),
          el('div', { class: 'card-key-title' }, [row.entry.key]),
        ],
      ) as HTMLButtonElement;

      row.button = button;

      button.addEventListener('click', () => {
        this.selectRow(row);
      });

      this.listContainer.append(button);
    }
  }

  selectRow(row: MaterialRow): void {
    if (this.activeRow?.button) {
      this.activeRow.button.classList.remove('active');
    }
    this.activeRow = row;
    row.button?.classList.add('active');
    this.onSelect({ theme: row.theme, entry: row.entry });
  }

  selectFirst(): void {
    if (this.allRows.length > 0) {
      this.selectRow(this.allRows[0]);
    }
  }
}

async function readJson(fetcher: typeof fetch, path: string): Promise<unknown> {
  const response = await fetcher(path);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}
