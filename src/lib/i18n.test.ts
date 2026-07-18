import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import zh from '../locales/zh.json';
import i18n from './i18n';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return entry === 'types' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !entry.includes('.test.') ? [path] : [];
  });
}

describe('internationalization policy', () => {
  it('keeps the English and Chinese locale trees in sync', () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(zh).sort());
  });

  it('changes visible copy when the active language changes', async () => {
    await i18n.changeLanguage('zh');
    expect(i18n.t('settings.title')).toBe('偏好设置');
    await i18n.changeLanguage('en');
    expect(i18n.t('settings.title')).toBe('Preferences');
  });

  it('does not hardcode Chinese user-facing strings in TypeScript components or stores', () => {
    const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
    const violations: string[] = [];
    for (const path of sourceFiles(sourceRoot)) {
      const source = readFileSync(path, 'utf8');
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        if (
          (ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isJsxText(node)) &&
          /\p{Script=Han}/u.test(node.text)
        ) {
          const position = file.getLineAndCharacterOfPosition(node.getStart(file));
          violations.push(`${path}:${position.line + 1}:${node.text.trim()}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
    }
    expect(violations).toEqual([]);
  });
});
