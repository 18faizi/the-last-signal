/**
 * Field Notes & Investigation Journal UI (Milestone 1.3).
 *
 * Minimal, atmospheric vanilla DOM modal interface toggleable via 'J' or close button.
 * Displays discovered environmental clues, multi-clue evidence chains, telemetry frequencies,
 * archived documents with page flipping/redactions, and active investigation directives.
 */

import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { FirstPersonController } from '../../../game/player/FirstPersonController';
import type { InputLockToken } from '../../../game/player/InputLock';
import type { InvestigationStore } from '../InvestigationStore';
import type { InvestigationClue, StructuredDocument } from '../types';

export type FieldNotesTab = 'clues' | 'frequencies' | 'documents' | 'directives';

export class FieldNotesUI implements Disposable {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly navContainer: HTMLElement;
  private readonly contentContainer: HTMLElement;
  private readonly closeButton: HTMLButtonElement;

  private lockToken: InputLockToken | null = null;
  private currentTab: FieldNotesTab = 'clues';
  private selectedClueId: string | null = null;
  private selectedDocId: string | null = null;
  private selectedDocPage = 0;
  private isOpenState = false;

  private readonly keydownListener = (event: KeyboardEvent): void => {
    if (event.code === 'KeyJ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // If user is typing in an input, ignore
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      event.preventDefault();
      this.toggle();
    } else if (event.code === 'Escape' && this.isOpenState) {
      event.preventDefault();
      this.close();
    }
  };

  constructor(
    private readonly parent: HTMLElement,
    private readonly store: InvestigationStore,
    private readonly player: FirstPersonController,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'field-notes-modal';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Field Notes and Investigation Journal');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(4, 8, 14, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9500',
      color: '#e2ebf5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      opacity: '0',
      transition: 'opacity 0.2s ease',
      pointerEvents: 'none',
    });

    this.panel = document.createElement('div');
    this.panel.className = 'field-notes-panel';
    Object.assign(this.panel.style, {
      width: '900px',
      maxWidth: 'calc(100vw - 48px)',
      height: '620px',
      maxHeight: 'calc(100vh - 48px)',
      background: '#0d131c',
      border: '1px solid rgba(100, 181, 246, 0.35)',
      borderRadius: '8px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.75)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    });

    // Top Header Bar
    const header = document.createElement('header');
    Object.assign(header.style, {
      padding: '16px 24px',
      background: 'rgba(15, 23, 36, 0.95)',
      borderBottom: '1px solid rgba(70, 95, 125, 0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    });

    const headerLeft = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'FIELD NOTES & INVESTIGATION DOSSIER';
    Object.assign(title.style, {
      margin: '0',
      fontSize: '15px',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#90caf9',
      fontWeight: '700',
    });

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Station Outpost Echo · Physical Evidence & Signal Telemetry';
    Object.assign(subtitle.style, {
      margin: '4px 0 0 0',
      fontSize: '11px',
      color: 'rgba(180, 205, 230, 0.65)',
      letterSpacing: '0.5px',
    });
    headerLeft.append(title, subtitle);

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.textContent = 'CLOSE [J / ESC]';
    Object.assign(this.closeButton.style, {
      padding: '6px 14px',
      background: 'rgba(25, 38, 56, 0.8)',
      border: '1px solid rgba(100, 181, 246, 0.4)',
      color: '#e2ebf5',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.5px',
    });
    this.closeButton.addEventListener('click', () => this.close());

    header.append(headerLeft, this.closeButton);

    // Nav Bar Tabs
    this.navContainer = document.createElement('nav');
    Object.assign(this.navContainer.style, {
      display: 'flex',
      gap: '4px',
      padding: '0 24px',
      background: 'rgba(10, 16, 26, 0.9)',
      borderBottom: '1px solid rgba(70, 95, 125, 0.25)',
    });
    this.renderTabs();

    // Body Area
    this.contentContainer = document.createElement('div');
    Object.assign(this.contentContainer.style, {
      flex: '1',
      display: 'flex',
      overflow: 'hidden',
      padding: '20px 24px',
      gap: '20px',
    });

    this.panel.append(header, this.navContainer, this.contentContainer);
    this.root.append(this.panel);
    this.parent.append(this.root);

    document.addEventListener('keydown', this.keydownListener);

    // Subscribe to store updates to keep UI synced
    this.store.subscribeState(() => {
      if (this.isOpenState) {
        this.renderCurrentTab();
      }
    });
  }

  public get isOpen(): boolean {
    return this.isOpenState;
  }

  public toggle(): void {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    if (this.isOpenState) return;
    this.isOpenState = true;
    this.lockToken = this.player.acquireInputLock('document');
    this.player.setPointerLockPromptSuppressed(true);
    if (document.pointerLockElement !== null) {
      document.exitPointerLock();
    }

    this.root.hidden = false;
    this.root.style.pointerEvents = 'auto';
    requestAnimationFrame(() => {
      this.root.style.opacity = '1';
    });

    this.renderTabs();
    this.renderCurrentTab();
    this.closeButton.focus();
  }

  public close(): void {
    if (!this.isOpenState) return;
    this.isOpenState = false;
    this.root.style.opacity = '0';
    this.root.style.pointerEvents = 'none';

    setTimeout(() => {
      if (!this.isOpenState) {
        this.root.hidden = true;
      }
    }, 200);

    this.player.setPointerLockPromptSuppressed(false);
    if (this.lockToken !== null) {
      this.player.releaseInputLock(this.lockToken);
      this.lockToken = null;
    }
    this.canvas.focus();
  }

  private renderTabs(): void {
    this.navContainer.replaceChildren();

    const tabs: Array<{ id: FieldNotesTab; label: string; count?: number }> = [
      {
        id: 'clues',
        label: 'Clues & Evidence',
        count: this.store.getDiscoveredClues().length,
      },
      {
        id: 'frequencies',
        label: 'Frequencies & Telemetry',
        count: this.store.getUnlockedFrequencies().length,
      },
      {
        id: 'documents',
        label: 'Document Archive',
        count: this.store.getDiscoveredDocuments().length,
      },
      {
        id: 'directives',
        label: 'Investigation Directives',
      },
    ];

    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const badge = tab.count !== undefined ? ` (${tab.count})` : '';
      btn.textContent = `${tab.label}${badge}`;
      const isActive = this.currentTab === tab.id;

      Object.assign(btn.style, {
        padding: '10px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: isActive ? '2px solid #64b5f6' : '2px solid transparent',
        color: isActive ? '#64b5f6' : 'rgba(226, 235, 245, 0.65)',
        fontSize: '12px',
        fontWeight: '600',
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'color 0.15s ease, border-color 0.15s ease',
      });

      btn.addEventListener('click', () => {
        this.currentTab = tab.id;
        this.renderTabs();
        this.renderCurrentTab();
      });

      this.navContainer.append(btn);
    }
  }

  private renderCurrentTab(): void {
    this.contentContainer.replaceChildren();

    switch (this.currentTab) {
      case 'clues':
        this.renderCluesTab();
        break;
      case 'frequencies':
        this.renderFrequenciesTab();
        break;
      case 'documents':
        this.renderDocumentsTab();
        break;
      case 'directives':
        this.renderDirectivesTab();
        break;
    }
  }

  // ----- Tab 1: Clues --------------------------------------------------------

  private renderCluesTab(): void {
    const clues = this.store.getDiscoveredClues();

    // Left List
    const listPane = document.createElement('div');
    Object.assign(listPane.style, {
      width: '320px',
      borderRight: '1px solid rgba(70, 95, 125, 0.25)',
      paddingRight: '16px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    if (clues.length === 0) {
      const empty = document.createElement('p');
      empty.textContent =
        'No clues discovered yet. Inspect documents, wall diagrams, and electronic equipment throughout the station.';
      Object.assign(empty.style, {
        color: 'rgba(180, 205, 230, 0.55)',
        fontSize: '12px',
        fontStyle: 'italic',
        lineHeight: '1.5',
      });
      listPane.append(empty);
    } else {
      const firstClue = clues[0];
      if (firstClue && (!this.selectedClueId || !clues.some((c) => c.id === this.selectedClueId))) {
        this.selectedClueId = firstClue.id;
      }

      for (const clue of clues) {
        const item = document.createElement('div');
        const isSelected = this.selectedClueId === clue.id;
        Object.assign(item.style, {
          padding: '10px 12px',
          background: isSelected ? 'rgba(30, 50, 78, 0.65)' : 'rgba(16, 24, 38, 0.45)',
          border: isSelected ? '1px solid #64b5f6' : '1px solid rgba(70, 95, 125, 0.2)',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        });

        const itemTitle = document.createElement('h4');
        itemTitle.textContent = clue.title;
        Object.assign(itemTitle.style, {
          margin: '0 0 4px 0',
          fontSize: '13px',
          color: isSelected ? '#90caf9' : '#e2ebf5',
          fontWeight: '600',
        });

        const itemMeta = document.createElement('div');
        Object.assign(itemMeta.style, {
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'rgba(180, 205, 230, 0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        });
        itemMeta.innerHTML = `<span>${clue.clueType}</span><span>${clue.zoneId.replace('fz-', '')}</span>`;

        item.append(itemTitle, itemMeta);
        item.addEventListener('click', () => {
          this.selectedClueId = clue.id;
          this.renderCluesTab();
        });
        listPane.append(item);
      }
    }

    // Right Detail Pane
    const detailPane = document.createElement('div');
    Object.assign(detailPane.style, {
      flex: '1',
      overflowY: 'auto',
      paddingLeft: '8px',
    });

    const selectedClue = clues.find((c) => c.id === this.selectedClueId);
    if (selectedClue) {
      this.renderClueDetails(detailPane, selectedClue);
    } else {
      const placeholder = document.createElement('p');
      placeholder.textContent = 'Select a clue from the list to view detailed analysis.';
      Object.assign(placeholder.style, { color: 'rgba(180, 205, 230, 0.45)', fontStyle: 'italic' });
      detailPane.append(placeholder);
    }

    this.contentContainer.append(listPane, detailPane);
  }

  private renderClueDetails(container: HTMLElement, clue: InvestigationClue): void {
    const title = document.createElement('h3');
    title.textContent = clue.title;
    Object.assign(title.style, {
      margin: '0 0 8px 0',
      fontSize: '18px',
      color: '#90caf9',
      fontWeight: '600',
    });

    const meta = document.createElement('div');
    Object.assign(meta.style, {
      display: 'flex',
      gap: '12px',
      fontSize: '11px',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      color: '#64b5f6',
      marginBottom: '16px',
    });
    meta.innerHTML = `<span>TYPE: ${clue.clueType}</span> · <span>LOCATION: ${clue.zoneId}</span>`;

    const desc = document.createElement('p');
    desc.textContent = clue.description;
    Object.assign(desc.style, {
      fontSize: '13px',
      lineHeight: '1.6',
      color: '#d0dfea',
      marginBottom: '20px',
    });

    // Associated Evidence Chain Card
    const chains = this.store.getAllChains().filter((ch) => ch.requiredClueIds.includes(clue.id));
    const chainBox = document.createElement('div');
    Object.assign(chainBox.style, {
      padding: '14px 16px',
      background: 'rgba(18, 28, 44, 0.7)',
      border: '1px solid rgba(100, 181, 246, 0.3)',
      borderRadius: '4px',
      marginTop: '12px',
    });

    const ch = chains[0];
    if (ch) {
      const isCompleted = this.store.isChainCompleted(ch.id);
      const chainHeader = document.createElement('div');
      chainHeader.innerHTML = `<span style="font-size: 11px; text-transform: uppercase; color: #90caf9; font-weight: bold; letter-spacing: 1px;">CONNECTED EVIDENCE CHAIN:</span> <span style="font-size: 11px; color: ${isCompleted ? '#66bb6a' : '#ffa726'}; font-weight: bold;">${isCompleted ? '✓ RESOLVED' : '⏳ INCOMPLETE'}</span>`;

      const chTitle = document.createElement('h4');
      chTitle.textContent = ch.title;
      Object.assign(chTitle.style, { margin: '8px 0 4px 0', fontSize: '14px', color: '#e2ebf5' });

      const chDesc = document.createElement('p');
      chDesc.textContent = ch.description;
      Object.assign(chDesc.style, {
        margin: '0 0 8px 0',
        fontSize: '12px',
        color: 'rgba(200, 220, 240, 0.75)',
        lineHeight: '1.4',
      });

      chainBox.append(chainHeader, chTitle, chDesc);
    } else {
      chainBox.textContent = 'No complex chain associated with this entry.';
    }

    container.append(title, meta, desc, chainBox);
  }

  // ----- Tab 2: Frequencies & Telemetry ---------------------------------------

  private renderFrequenciesTab(): void {
    const freqs = this.store.getUnlockedFrequencies();
    const codes = this.store.getUnlockedDoorCodes();

    const box = document.createElement('div');
    Object.assign(box.style, {
      flex: '1',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      overflowY: 'auto',
    });

    // Frequencies Section
    const freqSec = document.createElement('div');
    const freqHeader = document.createElement('h3');
    freqHeader.textContent = 'DETECTED CARRIER FREQUENCIES';
    Object.assign(freqHeader.style, {
      fontSize: '14px',
      color: '#90caf9',
      letterSpacing: '1px',
      marginBottom: '8px',
    });
    freqSec.append(freqHeader);

    if (freqs.length === 0) {
      const empty = document.createElement('p');
      empty.textContent =
        'No radio frequencies logged. Check technician workbenches and transmission printouts.';
      Object.assign(empty.style, {
        fontSize: '12px',
        color: 'rgba(180, 205, 230, 0.55)',
        fontStyle: 'italic',
      });
      freqSec.append(empty);
    } else {
      const freqGrid = document.createElement('div');
      Object.assign(freqGrid.style, { display: 'flex', gap: '12px', flexWrap: 'wrap' });

      for (const f of freqs) {
        const card = document.createElement('div');
        Object.assign(card.style, {
          padding: '12px 18px',
          background: 'rgba(20, 32, 50, 0.75)',
          border: '1px solid #64b5f6',
          borderRadius: '4px',
          boxShadow: '0 0 10px rgba(100, 181, 246, 0.2)',
        });
        card.innerHTML = `<div style="font-size: 20px; font-weight: 700; color: #64b5f6;">${f.toFixed(1)} MHz</div><div style="font-size: 10px; text-transform: uppercase; color: #90caf9; margin-top: 4px;">HARMONIC LOCK</div>`;
        freqGrid.append(card);
      }
      freqSec.append(freqGrid);
    }

    // Door Codes Section
    const codeSec = document.createElement('div');
    const codeHeader = document.createElement('h3');
    codeHeader.textContent = 'RECOVERED ACCESS PASSCODES';
    Object.assign(codeHeader.style, {
      fontSize: '14px',
      color: '#90caf9',
      letterSpacing: '1px',
      marginBottom: '8px',
    });
    codeSec.append(codeHeader);

    if (codes.length === 0) {
      const empty = document.createElement('p');
      empty.textContent =
        'No security bypass codes discovered. Inspect schematic fragments and personnel notes.';
      Object.assign(empty.style, {
        fontSize: '12px',
        color: 'rgba(180, 205, 230, 0.55)',
        fontStyle: 'italic',
      });
      codeSec.append(empty);
    } else {
      const codeGrid = document.createElement('div');
      Object.assign(codeGrid.style, { display: 'flex', gap: '12px', flexWrap: 'wrap' });

      for (const c of codes) {
        const card = document.createElement('div');
        Object.assign(card.style, {
          padding: '12px 18px',
          background: 'rgba(20, 32, 50, 0.75)',
          border: '1px solid #ffb74d',
          borderRadius: '4px',
          boxShadow: '0 0 10px rgba(255, 183, 77, 0.2)',
        });
        card.innerHTML = `<div style="font-size: 20px; font-weight: 700; color: #ffb74d; letter-spacing: 2px;">${c}</div><div style="font-size: 10px; text-transform: uppercase; color: #ffe0b2; margin-top: 4px;">KEYPAD OVERRIDE</div>`;
        codeGrid.append(card);
      }
      codeSec.append(codeGrid);
    }

    box.append(freqSec, codeSec);
    this.contentContainer.append(box);
  }

  // ----- Tab 3: Documents ----------------------------------------------------

  private renderDocumentsTab(): void {
    const docs = this.store.getDiscoveredDocuments();

    // Left List
    const listPane = document.createElement('div');
    Object.assign(listPane.style, {
      width: '320px',
      borderRight: '1px solid rgba(70, 95, 125, 0.25)',
      paddingRight: '16px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    if (docs.length === 0) {
      const empty = document.createElement('p');
      empty.textContent =
        'No documents archived yet. Read clipboards and logs across station buildings.';
      Object.assign(empty.style, {
        color: 'rgba(180, 205, 230, 0.55)',
        fontSize: '12px',
        fontStyle: 'italic',
      });
      listPane.append(empty);
    } else {
      const firstDoc = docs[0];
      if (firstDoc && (!this.selectedDocId || !docs.some((d) => d.id === this.selectedDocId))) {
        this.selectedDocId = firstDoc.id;
        this.selectedDocPage = 0;
      }

      for (const doc of docs) {
        const item = document.createElement('div');
        const isSelected = this.selectedDocId === doc.id;
        Object.assign(item.style, {
          padding: '10px 12px',
          background: isSelected ? 'rgba(30, 50, 78, 0.65)' : 'rgba(16, 24, 38, 0.45)',
          border: isSelected ? '1px solid #64b5f6' : '1px solid rgba(70, 95, 125, 0.2)',
          borderRadius: '4px',
          cursor: 'pointer',
        });

        const itemTitle = document.createElement('h4');
        itemTitle.textContent = doc.title;
        Object.assign(itemTitle.style, {
          margin: '0 0 4px 0',
          fontSize: '12px',
          color: isSelected ? '#90caf9' : '#e2ebf5',
        });

        const itemMeta = document.createElement('div');
        Object.assign(itemMeta.style, { fontSize: '10px', color: 'rgba(180, 205, 230, 0.6)' });
        itemMeta.textContent = [doc.date, doc.author].filter(Boolean).join(' · ');

        item.append(itemTitle, itemMeta);
        item.addEventListener('click', () => {
          this.selectedDocId = doc.id;
          this.selectedDocPage = 0;
          this.renderDocumentsTab();
        });
        listPane.append(item);
      }
    }

    // Right Reader Pane
    const readerPane = document.createElement('div');
    Object.assign(readerPane.style, {
      flex: '1',
      overflowY: 'auto',
      paddingLeft: '8px',
      display: 'flex',
      flexDirection: 'column',
    });

    const selectedDoc = docs.find((d) => d.id === this.selectedDocId);
    if (selectedDoc) {
      this.renderDocumentViewer(readerPane, selectedDoc);
    } else {
      const placeholder = document.createElement('p');
      placeholder.textContent = 'Select a document from the archive.';
      Object.assign(placeholder.style, { color: 'rgba(180, 205, 230, 0.45)', fontStyle: 'italic' });
      readerPane.append(placeholder);
    }

    this.contentContainer.append(listPane, readerPane);
  }

  private renderDocumentViewer(container: HTMLElement, doc: StructuredDocument): void {
    const title = document.createElement('h3');
    title.textContent = doc.title;
    Object.assign(title.style, { margin: '0 0 6px 0', fontSize: '16px', color: '#90caf9' });

    const meta = document.createElement('p');
    meta.textContent = [doc.date, doc.author].filter(Boolean).join(' · ');
    Object.assign(meta.style, {
      margin: '0 0 16px 0',
      fontSize: '11px',
      color: 'rgba(180, 205, 230, 0.6)',
    });

    // Page text
    const pageText = document.createElement('div');
    Object.assign(pageText.style, {
      flex: '1',
      padding: '16px',
      background: 'rgba(12, 18, 28, 0.85)',
      border: '1px solid rgba(70, 95, 125, 0.3)',
      borderRadius: '4px',
      fontSize: '13px',
      lineHeight: '1.6',
      color: '#dbe7f2',
      marginBottom: '12px',
    });
    pageText.textContent = doc.pages[this.selectedDocPage] ?? 'No text';

    // Flip notes (if any)
    if (doc.flipNotes) {
      const flipBox = document.createElement('div');
      Object.assign(flipBox.style, {
        padding: '10px 14px',
        background: 'rgba(35, 45, 30, 0.5)',
        border: '1px solid rgba(139, 195, 74, 0.4)',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#c5e1a5',
        fontStyle: 'italic',
        marginBottom: '12px',
      });
      flipBox.textContent = `Annotated Notes: ${doc.flipNotes}`;
      container.append(title, meta, pageText, flipBox);
    } else {
      container.append(title, meta, pageText);
    }

    // Page navigation (if multi-page)
    if (doc.pages.length > 1) {
      const nav = document.createElement('div');
      Object.assign(nav.style, {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        justifyContent: 'center',
      });

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.textContent = '◀ PREV PAGE';
      prevBtn.disabled = this.selectedDocPage === 0;
      prevBtn.addEventListener('click', () => {
        if (this.selectedDocPage > 0) {
          this.selectedDocPage--;
          this.renderDocumentsTab();
        }
      });

      const pageIndicator = document.createElement('span');
      pageIndicator.textContent = `Page ${this.selectedDocPage + 1} of ${doc.pages.length}`;
      pageIndicator.style.fontSize = '12px';

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.textContent = 'NEXT PAGE ▶';
      nextBtn.disabled = this.selectedDocPage >= doc.pages.length - 1;
      nextBtn.addEventListener('click', () => {
        if (this.selectedDocPage < doc.pages.length - 1) {
          this.selectedDocPage++;
          this.renderDocumentsTab();
        }
      });

      nav.append(prevBtn, pageIndicator, nextBtn);
      container.append(nav);
    }
  }

  // ----- Tab 4: Directives ---------------------------------------------------

  private renderDirectivesTab(): void {
    const box = document.createElement('div');
    Object.assign(box.style, { flex: '1', overflowY: 'auto' });

    const header = document.createElement('h3');
    header.textContent = 'INVESTIGATION DIRECTIVES & EVIDENCE CHAINS';
    Object.assign(header.style, {
      fontSize: '15px',
      color: '#90caf9',
      letterSpacing: '1px',
      marginBottom: '16px',
    });

    const allChains = this.store.getAllChains();
    const chainList = document.createElement('div');
    Object.assign(chainList.style, { display: 'flex', flexDirection: 'column', gap: '12px' });

    for (const chain of allChains) {
      const isResolved = this.store.isChainCompleted(chain.id);
      const card = document.createElement('div');
      Object.assign(card.style, {
        padding: '14px 16px',
        background: isResolved ? 'rgba(25, 45, 35, 0.6)' : 'rgba(20, 28, 42, 0.6)',
        border: isResolved ? '1px solid #66bb6a' : '1px solid rgba(70, 95, 125, 0.3)',
        borderRadius: '4px',
      });

      const top = document.createElement('div');
      Object.assign(top.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
      });
      top.innerHTML = `<span style="font-weight: 700; color: #e2ebf5; font-size: 14px;">${chain.title}</span><span style="font-size: 11px; font-weight: bold; color: ${isResolved ? '#81c784' : '#ffa726'};">${isResolved ? '✓ SOLVED' : 'IN PROGRESS'}</span>`;

      const p = document.createElement('p');
      p.textContent = chain.description;
      Object.assign(p.style, {
        margin: '0 0 8px 0',
        fontSize: '12px',
        color: 'rgba(210, 225, 240, 0.75)',
        lineHeight: '1.5',
      });

      // Requirements
      const req = document.createElement('div');
      Object.assign(req.style, { fontSize: '11px', color: 'rgba(180, 205, 230, 0.6)' });
      const reqList = chain.requiredClueIds
        .map((cid) => {
          const found = this.store.isClueDiscovered(cid);
          const clueDef = this.store.getClue(cid);
          const name = clueDef?.title ?? cid;
          return `<span style="color: ${found ? '#64b5f6' : 'rgba(150, 170, 190, 0.5)'};">${found ? '☑' : '☐'} ${name}</span>`;
        })
        .join(' · ');
      req.innerHTML = `Required Clues: ${reqList}`;

      card.append(top, p, req);
      chainList.append(card);
    }

    box.append(header, chainList);
    this.contentContainer.append(box);
  }

  public dispose(): void {
    document.removeEventListener('keydown', this.keydownListener);
    if (this.isOpenState && this.lockToken !== null) {
      this.player.releaseInputLock(this.lockToken);
      this.lockToken = null;
    }
    this.root.remove();
  }
}
