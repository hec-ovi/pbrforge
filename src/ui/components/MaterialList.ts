import { el } from './el.js';
import { createSquareInput, createSquareButton, createBadge } from '../ui/elements.js';
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

export class MaterialList {
  readonly root: HTMLElement;
  private listContainer: HTMLElement;
  private searchInput: HTMLInputElement;
  private countLabel: HTMLElement;

  // Kept for backward compatibility and test API compatibility
  readonly themeSelect: HTMLSelectElement;
  readonly kindSelect: HTMLSelectElement;
  readonly tierSelect: HTMLSelectElement;

  private allRows: MaterialRow[] = [];
  private activeRow?: MaterialRow;
  private currentSearch = '';
  private currentTheme = 'all';
  private currentKind = 'all';
  private currentTier = 'all';

  // Expansion states for tree nodes
  private expandedNodes = new Set<string>();

  constructor(
    private onSelect: (selection: Selection) => void,
    tag = 'LIB',
    title = 'MATERIALS',
    searchPlaceholder = 'Filter key, kind, tier...',
  ) {
    this.searchInput = createSquareInput({
      type: 'search',
      placeholder: searchPlaceholder,
      ariaLabel: 'Search materials',
      onInput: (val) => {
        this.currentSearch = val.trim().toLowerCase();
        this.applyFilter();
      },
    });
    this.searchInput.className = 'input-search';

    // Virtual hidden select controls to retain contract/filter event testing
    this.themeSelect = document.createElement('select');
    this.themeSelect.setAttribute('aria-label', 'Filter theme');
    this.themeSelect.className = 'visually-hidden';
    this.themeSelect.addEventListener('change', () => {
      this.currentTheme = this.themeSelect.value;
      this.applyFilter();
    });

    this.kindSelect = document.createElement('select');
    this.kindSelect.setAttribute('aria-label', 'Filter kind');
    this.kindSelect.className = 'visually-hidden';
    this.kindSelect.addEventListener('change', () => {
      this.currentKind = this.kindSelect.value;
      this.applyFilter();
    });

    this.tierSelect = document.createElement('select');
    this.tierSelect.setAttribute('aria-label', 'Filter tier');
    this.tierSelect.className = 'visually-hidden';
    this.tierSelect.addEventListener('change', () => {
      this.currentTier = this.tierSelect.value;
      this.applyFilter();
    });

    this.countLabel = el('span', { class: 'list-count-badge' }, ['0 items']);
    this.listContainer = el('nav', { class: 'material-tree-container', 'aria-label': 'materials' });

    const header = el('div', { class: 'list-header' }, [
      el('div', { class: 'list-title-row' }, [
        createBadge(tag, 'sidebar-tag'),
        el('h1', { class: 'sidebar-title' }, [title]),
        this.countLabel,
      ]),
      el('div', { class: 'filter-bar' }, [
        el('div', { class: 'search-box' }, [this.searchInput]),
        this.themeSelect,
        this.kindSelect,
        this.tierSelect,
      ]),
    ]);

    this.root = el('div', { class: 'material-list-widget' }, [header, this.listContainer]);
  }

  async load(fetcher: typeof fetch = fetch): Promise<void> {
    try {
      const themes = await readJson(fetcher, '/api/themes');
      if (!Array.isArray(themes) || themes.some((theme) => typeof theme !== 'string')) {
        throw new TypeError('theme list must be an array of strings');
      }
      const rows: MaterialRow[] = [];

      for (const theme of themes) {
        const index = (await readJson(fetcher, `/themes/${theme}/theme.json`)) as ThemeIndex;
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
      // Auto-expand all discovered groups by default
      for (const row of rows) {
        this.expandedNodes.add(row.theme);
        this.expandedNodes.add(`${row.theme}/${row.kind}`);
      }
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
      this.themeSelect.append(el('option', { value: t }, [t]));
    }

    this.kindSelect.replaceChildren(el('option', { value: 'all' }, ['ALL KINDS']));
    for (const k of Array.from(kinds).sort()) {
      this.kindSelect.append(el('option', { value: k }, [k]));
    }

    this.tierSelect.replaceChildren(el('option', { value: 'all' }, ['ALL TIERS']));
    for (const tr of Array.from(tiers).sort()) {
      this.tierSelect.append(el('option', { value: tr }, [tr]));
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
      const clearBtn = createSquareButton({
        label: 'Reset search',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
          this.searchInput.value = '';
          this.currentSearch = '';
          this.themeSelect.value = 'all';
          this.currentTheme = 'all';
          this.kindSelect.value = 'all';
          this.currentKind = 'all';
          this.tierSelect.value = 'all';
          this.currentTier = 'all';
          this.applyFilter();
        },
      });
      this.listContainer.append(
        el('div', { class: 'empty-filter-state' }, [
          el('p', { class: 'empty' }, ['No materials match current filters']),
          clearBtn,
        ]),
      );
      return;
    }

    // Build hierarchical tree: theme -> kind -> materials
    const tree = new Map<string, Map<string, MaterialRow[]>>();
    for (const row of filtered) {
      if (!tree.has(row.theme)) {
        tree.set(row.theme, new Map());
      }
      const kinds = tree.get(row.theme)!;
      if (!kinds.has(row.kind)) {
        kinds.set(row.kind, []);
      }
      kinds.get(row.kind)!.push(row);
    }

    for (const [themeName, kindMap] of tree.entries()) {
      const isThemeExpanded = this.expandedNodes.has(themeName) || Boolean(this.currentSearch);

      const themeHeader = el(
        'button',
        {
          type: 'button',
          class: `tree-node-header tree-node-theme ${isThemeExpanded ? 'expanded' : 'collapsed'}`,
          'aria-expanded': String(isThemeExpanded),
        },
        [
          el('span', { class: 'tree-caret' }, [isThemeExpanded ? '▼' : '▶']),
          el('span', { class: 'tree-node-title' }, [themeName]),
        ],
      );

      const themeChildren = el('div', {
        class: `tree-children ${isThemeExpanded ? 'visible' : 'hidden'}`,
      });

      themeHeader.addEventListener('click', () => {
        if (this.expandedNodes.has(themeName)) {
          this.expandedNodes.delete(themeName);
        } else {
          this.expandedNodes.add(themeName);
        }
        this.applyFilter();
      });

      for (const [kindName, rows] of kindMap.entries()) {
        const kindKey = `${themeName}/${kindName}`;
        const isKindExpanded = this.expandedNodes.has(kindKey) || Boolean(this.currentSearch);

        const kindHeader = el(
          'button',
          {
            type: 'button',
            class: `tree-node-header tree-node-kind ${isKindExpanded ? 'expanded' : 'collapsed'}`,
            'aria-expanded': String(isKindExpanded),
          },
          [
            el('span', { class: 'tree-caret' }, [isKindExpanded ? '▼' : '▶']),
            el('span', { class: 'tree-node-title' }, [kindName]),
            el('span', { class: 'tree-node-count' }, [String(rows.length)]),
          ],
        );

        const kindChildren = el('div', {
          class: `tree-children ${isKindExpanded ? 'visible' : 'hidden'}`,
        });

        kindHeader.addEventListener('click', () => {
          if (this.expandedNodes.has(kindKey)) {
            this.expandedNodes.delete(kindKey);
          } else {
            this.expandedNodes.add(kindKey);
          }
          this.applyFilter();
        });

        for (const row of rows) {
          const item = el(
            'button',
            {
              type: 'button',
              class: `tree-leaf-item ${this.activeRow === row ? 'active' : ''}`,
              'data-key': row.entry.key,
              title: row.entry.key,
            },
            [
              el('span', { class: 'tree-bullet' }, ['•']),
              el('span', { class: 'tree-leaf-name' }, [row.tier]),
              el('span', { class: 'tree-leaf-fullkey visually-hidden' }, [row.entry.key]),
              createBadge(row.entry.alignment.toUpperCase(), `badge-${row.entry.alignment}`),
            ],
          ) as HTMLButtonElement;

          row.button = item;

          item.addEventListener('click', () => {
            this.selectRow(row);
          });

          kindChildren.append(item);
        }

        themeChildren.append(kindHeader, kindChildren);
      }

      this.listContainer.append(themeHeader, themeChildren);
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
