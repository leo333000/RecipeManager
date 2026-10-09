// Toasts, confirmation dialogs and a helper for buttons that start slow work.

import { h } from '../dom.js';

const TOAST_MS = 3500;

export function toast(message, { type = 'info' } = {}) {
  const container = document.getElementById('toasts');
  const item = h('div', { class: `toast ${type === 'error' ? 'error' : ''}`, text: message });
  container.append(item);
  setTimeout(() => item.remove(), type === 'error' ? TOAST_MS * 2 : TOAST_MS);
}

export function toastError(error) {
  toast(error?.message ?? 'Something went wrong', { type: 'error' });
}

/** Resolves true when the user confirms. */
export function confirmDialog(message, { confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { 'aria-label': 'Confirm' });
    const close = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.append(
      h('p', { text: message }),
      h(
        'div',
        { class: 'button-row' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => close(false) }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => close(true) }, confirmLabel),
      ),
    );
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(false);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/** Asks for a short text. Resolves the trimmed text, or null when cancelled or empty. */
export function promptDialog(label, value = '') {
  return new Promise((resolve) => {
    const input = h('input', { value, maxlength: 80, 'aria-label': label });
    const dialog = h('dialog', { 'aria-label': label });
    const close = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    dialog.append(
      h('form', {
        class: 'form',
        onsubmit: (event) => {
          event.preventDefault();
          close(input.value.trim() || null);
        },
      },
        h('label', { class: 'field' }, h('span', { text: label }), input),
        h('div', { class: 'button-row' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => close(null) }, 'Cancel'),
          h('button', { class: 'btn primary', type: 'submit' }, 'Save'),
        ),
      ),
    );
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(null);
    });
    document.body.append(dialog);
    dialog.showModal();
    input.select();
  });
}

/**
 * Disables `buttonElement` while `task` runs and shows `busyLabel` on it.
 * Errors are shown as a toast. Returns the task's result, or undefined on error.
 */
export async function withBusy(buttonElement, busyLabel, task) {
  const label = buttonElement.textContent;
  buttonElement.disabled = true;
  buttonElement.textContent = busyLabel;
  try {
    return await task();
  } catch (error) {
    toastError(error);
    return undefined;
  } finally {
    if (buttonElement.isConnected) {
      buttonElement.disabled = false;
      buttonElement.textContent = label;
    }
  }
}
