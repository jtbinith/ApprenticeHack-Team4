// Modal dialog built on <dialog>. Used by the journal entry form (#50), log hours (#53), etc.
//
//   const d = openDialog({ title: 'New entry', body: formEl, actions: [
//     { label: 'Cancel', variant: 'secondary' },
//     { label: 'Save', variant: 'primary', onClick: () => save() },
//   ]});
//
// An action closes the dialog unless its onClick returns false.

import { icon } from './icons';

export interface DialogAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'brown';
  onClick?: () => boolean | void;
}

export interface DialogOptions {
  title: string;
  body: HTMLElement | string;
  actions?: DialogAction[];
  onClose?: () => void;
}

export function openDialog(options: DialogOptions): { close: () => void } {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog';
  dialog.innerHTML = `
    <header class="dialog-header">
      <h2 class="dialog-title"></h2>
      <button class="btn btn-icon" data-close aria-label="Close">${icon('x')}</button>
    </header>
    <div class="dialog-body"></div>
    <footer class="dialog-actions"></footer>`;
  (dialog.querySelector('.dialog-title') as HTMLElement).textContent =
    options.title;

  const body = dialog.querySelector('.dialog-body') as HTMLElement;
  if (typeof options.body === 'string') body.innerHTML = options.body;
  else body.append(options.body);

  const close = () => dialog.close();
  dialog.querySelector('[data-close]')?.addEventListener('click', close);

  const footer = dialog.querySelector('.dialog-actions') as HTMLElement;
  for (const action of options.actions ?? []) {
    const button = document.createElement('button');
    button.className = `btn btn-${action.variant ?? 'secondary'}`;
    button.textContent = action.label;
    button.addEventListener('click', () => {
      if (action.onClick?.() !== false) close();
    });
    footer.append(button);
  }

  dialog.addEventListener('close', () => {
    options.onClose?.();
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
  body.querySelector<HTMLElement>('input, select, textarea')?.focus();
  return { close };
}
