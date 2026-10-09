// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { h, replace } from '../../frontend/js/dom.js';

describe('h', () => {
  it('inserts text as text, never as markup', () => {
    const element = h('p', {}, '<img src=x onerror=alert(1)>');
    expect(element.children).toHaveLength(0);
    expect(element.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(h('p', { text: '<b>hi</b>' }).innerHTML).toBe('&lt;b&gt;hi&lt;/b&gt;');
  });

  it('sets classes, attributes, properties, data and listeners', () => {
    const onclick = vi.fn();
    const button = h('button', { class: 'btn primary', 'aria-label': 'Save', disabled: true, dataset: { id: '7' }, onclick });
    expect(button.className).toBe('btn primary');
    expect(button.getAttribute('aria-label')).toBe('Save');
    expect(button.disabled).toBe(true);
    expect(button.dataset.id).toBe('7');
    button.disabled = false;
    button.click();
    expect(onclick).toHaveBeenCalledOnce();
  });

  it('skips null, undefined and false props and children, and flattens arrays', () => {
    const list = h('ul', { title: null, hidden: false }, [h('li', {}, 'a'), null, [h('li', {}, 'b'), false]], undefined);
    expect(list.hasAttribute('title')).toBe(false);
    expect(list.hidden).toBe(false);
    expect([...list.children].map((item) => item.textContent)).toEqual(['a', 'b']);
  });

  it('sets input values as properties', () => {
    expect(h('input', { value: 'hello' }).value).toBe('hello');
  });
});

describe('replace', () => {
  it('swaps all children', () => {
    const parent = h('div', {}, 'old');
    replace(parent, h('span', {}, 'new'), 'text');
    expect(parent.textContent).toBe('newtext');
    expect(parent.childNodes).toHaveLength(2);
  });
});
