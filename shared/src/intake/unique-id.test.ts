import { describe, it, expect } from 'vitest';
import { slugifyTitle, generateSuffix, generateUniqueId } from './unique-id.js';

describe('slugifyTitle', () => {
  it('converts to lowercase', () => {
    expect(slugifyTitle('Contact Form')).toBe('contact-form');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugifyTitle('my form title')).toBe('my-form-title');
  });

  it('replaces underscores with hyphens', () => {
    expect(slugifyTitle('my_form_title')).toBe('my-form-title');
  });

  it('removes special characters', () => {
    expect(slugifyTitle('Form #1 (Test)')).toBe('form-1-test');
  });

  it('handles unicode/accented characters', () => {
    expect(slugifyTitle('Café Résumé')).toBe('cafe-resume');
  });

  it('collapses multiple hyphens', () => {
    expect(slugifyTitle('form---test')).toBe('form-test');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugifyTitle('--form--')).toBe('form');
  });

  it('truncates to max 50 chars', () => {
    const longTitle = 'a'.repeat(100);
    expect(slugifyTitle(longTitle)).toHaveLength(50);
  });

  it('returns empty string for empty input', () => {
    expect(slugifyTitle('')).toBe('');
  });

  it('returns empty string for only special characters', () => {
    expect(slugifyTitle('!@#$%^&*()')).toBe('');
  });
});

describe('generateSuffix', () => {
  it('returns a 6-character string', () => {
    const suffix = generateSuffix();
    expect(suffix).toHaveLength(6);
  });

  it('returns only lowercase alphanumeric characters', () => {
    const suffix = generateSuffix();
    expect(suffix).toMatch(/^[a-z0-9]{6}$/);
  });

  it('generates different values on each call', () => {
    const suffixes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      suffixes.add(generateSuffix());
    }
    // Should have at least 95 unique values out of 100
    expect(suffixes.size).toBeGreaterThan(95);
  });
});

describe('generateUniqueId', () => {
  it('combines slug and suffix with hyphen', () => {
    const id = generateUniqueId('Contact Form');
    expect(id).toMatch(/^contact-form-[a-z0-9]{6}$/);
  });

  it('handles titles with special characters', () => {
    const id = generateUniqueId("John's Form (v2)");
    expect(id).toMatch(/^johns-form-v2-[a-z0-9]{6}$/);
  });

  it('handles unicode titles', () => {
    const id = generateUniqueId('Über Form Spëcîäl');
    expect(id).toMatch(/^uber-form-special-[a-z0-9]{6}$/);
  });

  it('generates different IDs for same title', () => {
    const id1 = generateUniqueId('Test Form');
    const id2 = generateUniqueId('Test Form');
    expect(id1).not.toBe(id2);
  });

  it('handles empty title gracefully', () => {
    const id = generateUniqueId('');
    expect(id).toMatch(/^form-[a-z0-9]{6}$/);
  });

  it('handles title with only special chars', () => {
    const id = generateUniqueId('!@#$%');
    expect(id).toMatch(/^form-[a-z0-9]{6}$/);
  });
});
