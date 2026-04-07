import { describe, expect, it } from 'vitest';
import { buildMessagePreview } from './message-preview';

describe('buildMessagePreview', () => {
  it('returns short content unchanged', () => {
    expect(buildMessagePreview('hello world', 20)).toBe('hello world');
  });

  it('collapses whitespace', () => {
    expect(buildMessagePreview('hello\n\nworld\t!', 20)).toBe('hello world !');
  });

  it('truncates at nearest word boundary', () => {
    expect(buildMessagePreview('one two three four five six seven', 15)).toBe('one two three…');
  });
});
