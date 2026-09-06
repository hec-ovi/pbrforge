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

  private allRows: MaterialRow[] = [];
  private activeRow?: MaterialRow;
  private currentSearch = '';
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
      for (const row of rows) {
        this.expandedNodes.add(row.theme);
        this.expandedNodes.add(`${row.theme}/${row.kind}`);
      }
      this.applyFilter();
    } catch (cause) {
      throw new PreviewError('E_DATABASE_UNAVAILABLE', 'material database could not be loaded', cause);
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
      if (!this.currentSearch) return true;
      return (
        row.entry.key.toLowerCase().includes(this.currentSearch)
        || row.kind.toLowerCase().includes(this.currentSearch)
        || row.tier.toLowerCase().includes(this.currentSearch)
      );
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
      const themeOpen = this.expandedNodes.has(themeName) || Boolean(this.currentSearch);
      const themeHeader = this.nodeHeader('tree-node-theme', themeName, themeOpen);
      const { inner: themeInner, wrap: themeChildren } = this.childrenWrap(themeOpen);
      themeHeader.addEventListener('click', () => this.toggleNode(themeName, themeHeader, themeChildren));

      for (const [kindName, rows] of kindMap.entries()) {
        const kindKey = `${themeName}/${kindName}`;
        const kindOpen = this.expandedNodes.has(kindKey) || Boolean(this.currentSearch);
        const kindHeader = this.nodeHeader('tree-node-kind', kindName, kindOpen, String(rows.length));
        const { inner: kindInner, wrap: kindChildren } = this.childrenWrap(kindOpen);
        kindHeader.addEventListener('click', () => this.toggleNode(kindKey, kindHeader, kindChildren));

        for (const row of rows) {
          const item = this.leafButton(row);
          row.button = item;
          item.addEventListener('click', () => this.selectRow(row));
          kindInner.append(item);
        }

        themeInner.append(kindHeader, kindChildren);
      }

      this.listContainer.append(themeHeader, themeChildren);
    }
  }

  private nodeHeader(kindClass: string, title: string, expanded: boolean, count?: string): HTMLButtonElement {
    const kids: (HTMLElement | string)[] = [
      el('span', { class: 'tree-caret', 'aria-hidden': 'true' }),
      el('span', { class: 'tree-node-title' }, [title]),
    ];
    if (count !== undefined) kids.push(el('span', { class: 'tree-node-count' }, [count]));
    return el(
      'button',
      {
        type: 'button',
        class: `tree-node-header ${kindClass} ${expanded ? 'expanded' : 'collapsed'}`,
        'aria-expanded': String(expanded),
      },
      kids,
    ) as HTMLButtonElement;
  }

  private childrenWrap(expanded: boolean): { inner: HTMLElement; wrap: HTMLElement } {
    const inner = el('div', { class: 'tree-children-inner' });
    const wrap = el('div', { class: `tree-children ${expanded ? 'expanded' : 'collapsed'}` }, [inner]);
    return { inner, wrap };
  }

  private toggleNode(key: string, header: HTMLElement, children: HTMLElement): void {
    const next = !this.expandedNodes.has(key);
    if (next) this.expandedNodes.add(key);
    else this.expandedNodes.delete(key);
    header.classList.toggle('expanded', next);
    header.classList.toggle('collapsed', !next);
    header.setAttribute('aria-expanded', String(next));
    children.classList.toggle('expanded', next);
    children.classList.toggle('collapsed', !next);
  }

  private leafButton(row: MaterialRow): HTMLButtonElement {
    const thumbs = el('div', { class: 'tree-leaf-thumbs' });
    const maps = row.entry.variants[0]?.maps ?? {};
    for (const rel of Object.values(maps)) {
      if (!rel) continue;
      thumbs.append(
        el('img', {
          class: 'tree-leaf-thumb',
          src: `/themes/${row.theme}/${rel}`,
          alt: '',
          width: '32',
          height: '32',
        }),
      );
    }
    return el(
      'button',
      {
        type: 'button',
        class: `tree-leaf-item ${this.activeRow === row ? 'active' : ''}`,
        'data-key': row.entry.key,
        title: row.entry.key,
      },
      [
        thumbs,
        el('div', { class: 'tree-leaf-meta' }, [
          el('span', { class: 'tree-leaf-name' }, [row.tier]),
          el('span', { class: 'tree-leaf-fullkey visually-hidden' }, [row.entry.key]),
          createBadge(row.entry.alignment.toUpperCase(), `badge-${row.entry.alignment}`),
        ]),
      ],
    ) as HTMLButtonElement;
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
