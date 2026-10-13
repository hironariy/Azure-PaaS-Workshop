import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { expect, it } from 'vitest';

it('compiles the migrated stylesheet with the existing palette and shared form controls', async () => {
  const file = path.resolve('src/index.css');
  const source = await readFile(file, 'utf8');
  const result = await postcss([tailwindcss()]).process(source, { from: file });
  const selectors = new Set<string>();
  result.root.walkRules((rule) => { selectors.add(rule.selector); });
  for (const selector of ['.btn-primary', '.btn-secondary', '.btn-danger', '.input', '.card', '.link']) {
    expect(selectors.has(selector), selector).toBe(true);
  }
  const styles = new Map<string, Map<string, string>>();
  result.root.walkRules((rule) => {
    const declarations = new Map<string, string>();
    rule.each((node) => {
      if (node.type === 'decl') declarations.set(node.prop, node.value);
    });
    styles.set(rule.selector, declarations);
  });
  expect(styles.get('.btn-primary')?.get('background-color')).toBe('#2563eb');
  expect(styles.get('.btn-primary')?.get('display')).toBe('inline-flex');
  expect(styles.get('body')?.get('background-color')).toBe('#f9fafb');
  expect(styles.get('body')?.get('color')).toBe('#111827');
  expect(styles.get('.btn-danger')?.get('background-color')).toBe('#dc2626');
});
