// Evidence field: links and files (PDFs, images, documents…), stored on the device.
// Files are saved to the `files` table as soon as they're attached; the entry only
// keeps a reference, so large files never sit in the reflection itself.

import type { Evidence } from '../../../shared/types';
import { db, newId } from '../../db';
import { openDialog } from '../../ui/dialog';
import { escapeHtml } from '../../ui/dom';
import { icon } from '../../ui/icons';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface EvidenceField {
  element: HTMLElement;
  destroy(): void;
}

export function createEvidenceField(
  evidence: Evidence[],
  onChange: () => void,
): EvidenceField {
  const root = document.createElement('div');
  root.className = 'evidence';
  root.innerHTML = `
    <ul class="evidence-list"></ul>
    <div class="evidence-drop" tabindex="-1">
      <div class="evidence-add">
        <input class="input" name="evidence-url" type="url" placeholder="Paste a link (CR, doc, ticket…)" aria-label="Evidence link">
        <button type="button" class="btn btn-secondary" data-action="add-link">Add link</button>
        <button type="button" class="btn btn-secondary" data-action="attach">${icon('paperclip', 16)}Attach files</button>
        <input type="file" multiple hidden>
      </div>
      <p class="evidence-drop-hint">or drop PDFs, images or documents here · max 25 MB each</p>
    </div>
    <p class="evidence-error" role="alert" hidden></p>`;

  const list = root.querySelector('.evidence-list') as HTMLUListElement;
  const urlInput = root.querySelector(
    '[name="evidence-url"]',
  ) as HTMLInputElement;
  const fileInput = root.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const drop = root.querySelector('.evidence-drop') as HTMLElement;
  const errorEl = root.querySelector('.evidence-error') as HTMLElement;
  const objectUrls: string[] = [];

  function showError(message: string) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  async function render() {
    objectUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    const files = await db.files.bulkGet(
      evidence.flatMap((e) => (e.kind === 'file' ? [e.fileId] : [])),
    );
    const blobs = new Map(
      files.flatMap((f) => (f ? [[f.id, f.blob] as const] : [])),
    );

    list.innerHTML = evidence
      .map((item, i) => {
        const remove = `<button type="button" class="btn btn-icon btn-ghost" data-remove="${i}" aria-label="Remove">${icon('x', 16)}</button>`;
        if (item.kind === 'link') {
          return `<li class="evidence-item">
            <span class="evidence-icon">${icon('link', 18)}</span>
            <a class="evidence-name" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a>
            ${remove}</li>`;
        }
        const blob = blobs.get(item.fileId);
        const isImage = item.type.startsWith('image/') && blob;
        let thumb = `<span class="evidence-icon">${icon(item.type === 'application/pdf' ? 'file-text' : 'file', 18)}</span>`;
        if (isImage) {
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          thumb = `<img class="evidence-thumb" src="${url}" alt="">`;
        }
        return `<li class="evidence-item">
          ${thumb}
          <button type="button" class="evidence-name link-button" data-open="${i}" title="${blob ? 'Open' : 'File missing'}">${escapeHtml(item.name)}</button>
          <span class="evidence-size">${formatSize(item.size)}</span>
          ${remove}</li>`;
      })
      .join('');
  }

  function addLink() {
    const raw = urlInput.value.trim();
    if (!raw) return;
    const url = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    evidence.push({ kind: 'link', url });
    urlInput.value = '';
    showError('');
    render();
    onChange();
  }

  async function addFiles(files: FileList | File[]) {
    const tooBig: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        tooBig.push(file.name);
        continue;
      }
      const id = newId();
      await db.files.put({
        id,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        blob: file,
        addedAt: new Date().toISOString(),
      });
      evidence.push({
        kind: 'file',
        fileId: id,
        name: file.name,
        type: file.type,
        size: file.size,
      });
    }
    showError(
      tooBig.length ? `Too large (over 25 MB): ${tooBig.join(', ')}` : '',
    );
    await render();
    onChange();
  }

  async function open(item: Evidence & { kind: 'file' }) {
    const stored = await db.files.get(item.fileId);
    if (!stored) {
      showError(`“${item.name}” is no longer on this device.`);
      return;
    }
    if (stored.type.startsWith('image/')) {
      const url = URL.createObjectURL(stored.blob);
      openDialog({
        title: stored.name,
        wide: true,
        body: `<img class="evidence-preview" src="${url}" alt="${escapeHtml(stored.name)}">`,
        onClose: () => URL.revokeObjectURL(url),
      });
    } else {
      window.canopy
        .openFile(stored.name, await stored.blob.arrayBuffer())
        .catch((err) =>
          showError(`Couldn't open “${stored.name}”: ${String(err)}`),
        );
    }
  }

  root.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!button) return;
    if (button.dataset.action === 'add-link') addLink();
    else if (button.dataset.action === 'attach') fileInput.click();
    else if (button.dataset.remove) {
      evidence.splice(Number(button.dataset.remove), 1);
      render();
      onChange();
    } else if (button.dataset.open) {
      const item = evidence[Number(button.dataset.open)];
      if (item?.kind === 'file') open(item);
    }
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLink();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) addFiles(fileInput.files);
    fileInput.value = '';
  });

  drop.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    drop.classList.add('is-dragging');
  });
  drop.addEventListener('dragleave', () =>
    drop.classList.remove('is-dragging'),
  );
  drop.addEventListener('drop', (e) => {
    drop.classList.remove('is-dragging');
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });

  render();
  return {
    element: root,
    destroy: () => objectUrls.forEach((u) => URL.revokeObjectURL(u)),
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
