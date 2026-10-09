// Tiny DOM builder. Text is always inserted with text nodes, never innerHTML,
// so recipe content can never inject markup.

const PROPERTIES = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'open', 'required', 'multiple', 'indeterminate']);

/**
 * h('button', { class: 'btn', onclick: fn }, 'Save')
 * Props: `class`, `text`, `dataset`, `style` (object), on<event> handlers,
 * DOM properties (value, checked, ...) and any other attribute.
 */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = value;
    else if (key === 'text') element.textContent = value;
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key === 'style') Object.assign(element.style, value);
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value);
    else if (PROPERTIES.has(key)) element[key] = value;
    else element.setAttribute(key, value === true ? '' : String(value));
  }

  append(element, children);
  return element;
}

export function append(parent, children) {
  for (const child of [children].flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Replaces all children of `element`. */
export function replace(element, ...children) {
  element.replaceChildren();
  return append(element, children);
}
