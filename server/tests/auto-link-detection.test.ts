import { describe, expect, test } from "bun:test";
import {
  detectLinks,
  detectChannelRefs,
  countLinksByType,
  uniqueDomains,
  hasLinks,
} from "../src/utils/auto-link-detection";

describe("detectLinks", () => {
  test("detects HTTP URLs", () => {
    const links = detectLinks("check https://example.com for info");
    expect(links.length).toBe(1);
    expect(links[0].type).toBe("url");
    expect(links[0].href).toBe("https://example.com");
  });

  test("detects multiple URLs", () => {
    const links = detectLinks("see https://a.com and http://b.com");
    expect(links.length).toBe(2);
  });

  test("strips trailing punctuation from URLs", () => {
    const links = detectLinks("visit https://example.com.");
    expect(links[0].href).toBe("https://example.com");
  });

  test("detects email addresses", () => {
    const links = detectLinks("email me at user@example.com");
    expect(links.length).toBe(1);
    expect(links[0].type).toBe("email");
    expect(links[0].href).toBe("mailto:user@example.com");
  });

  test("detects GitHub issue references", () => {
    const links = detectLinks("see hyperslack/talkto#42 for details");
    expect(links.length).toBe(1);
    expect(links[0].type).toBe("github_issue");
    expect(links[0].href).toBe("https://github.com/hyperslack/talkto/issues/42");
  });

  test("does not duplicate emails inside URLs", () => {
    const links = detectLinks("https://user@example.com/path");
    // Should only detect the URL, not extract email from it
    const emailLinks = links.filter((l) => l.type === "email");
    expect(emailLinks.length).toBe(0);
  });

  test("returns links sorted by position", () => {
    const links = detectLinks("a@b.com then https://c.com");
    expect(links[0].start).toBeLessThan(links[1].start);
  });

  test("handles content with no links", () => {
    expect(detectLinks("just plain text")).toEqual([]);
  });
});

describe("detectChannelRefs", () => {
  test("detects channel references", () => {
    const refs = detectChannelRefs("see #general and #dev-team");
    expect(refs).toContain("general");
    expect(refs).toContain("dev-team");
  });

  test("deduplicates references", () => {
    const refs = detectChannelRefs("#general and #general again");
    expect(refs.length).toBe(1);
  });

  test("returns empty for no refs", () => {
    expect(detectChannelRefs("no channels here")).toEqual([]);
  });
});

describe("countLinksByType", () => {
  test("counts links by type", () => {
    const links = detectLinks("https://a.com user@b.com hyperslack/talkto#1");
    const counts = countLinksByType(links);
    expect(counts.url).toBe(1);
    expect(counts.email).toBe(1);
    expect(counts.github_issue).toBe(1);
  });
});

describe("uniqueDomains", () => {
  test("extracts unique domains", () => {
    const links = detectLinks("https://a.com/1 https://a.com/2 https://b.org");
    const domains = uniqueDomains(links);
    expect(domains).toEqual(["a.com", "b.org"]);
  });
});

describe("hasLinks", () => {
  test("true when content has URLs", () => {
    expect(hasLinks("visit https://example.com")).toBe(true);
  });

  test("true when content has emails", () => {
    expect(hasLinks("email user@test.com")).toBe(true);
  });

  test("false for plain text", () => {
    expect(hasLinks("hello world")).toBe(false);
  });
});
