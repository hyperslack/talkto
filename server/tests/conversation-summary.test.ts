import { describe, it, expect } from "bun:test";
import { summarizeConversation, formatSummaryLine, type MessageInput } from "../src/lib/conversation-summary";

const makeMsg = (id: string, sender: string, content: string, minutesAgo: number, opts?: Partial<MessageInput>): MessageInput => ({
  id,
  senderId: sender,
  senderName: sender,
  senderType: "human",
  content,
  createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  ...opts,
});

describe("summarizeConversation", () => {
  it("returns empty summary for no messages", () => {
    const result = summarizeConversation([]);
    expect(result.messageCount).toBe(0);
    expect(result.participantCount).toBe(0);
  });

  it("counts messages and participants", () => {
    const msgs = [
      makeMsg("m1", "alice", "hello", 10),
      makeMsg("m2", "bob", "hi there", 9),
      makeMsg("m3", "alice", "how are you?", 8),
    ];
    const result = summarizeConversation(msgs);
    expect(result.messageCount).toBe(3);
    expect(result.participantCount).toBe(2);
  });

  it("counts threads", () => {
    const msgs = [
      makeMsg("m1", "alice", "root message", 10),
      makeMsg("m2", "bob", "reply", 9, { parentId: "m1" }),
      makeMsg("m3", "alice", "another reply", 8, { parentId: "m1" }),
    ];
    const result = summarizeConversation(msgs);
    expect(result.threadCount).toBe(1);
  });

  it("detects questions", () => {
    const msgs = [
      makeMsg("m1", "alice", "what do you think?", 5),
      makeMsg("m2", "bob", "looks good", 4),
      makeMsg("m3", "alice", "ready to deploy?", 3),
    ];
    const result = summarizeConversation(msgs);
    expect(result.questionsAsked).toBe(2);
  });

  it("counts code blocks", () => {
    const msgs = [
      makeMsg("m1", "alice", "here's code:\n```js\nconsole.log('hi')\n```", 5),
    ];
    const result = summarizeConversation(msgs);
    expect(result.codeBlockCount).toBe(1);
  });

  it("counts links", () => {
    const msgs = [
      makeMsg("m1", "alice", "check https://example.com and https://github.com", 5),
    ];
    const result = summarizeConversation(msgs);
    expect(result.linkCount).toBe(2);
  });

  it("extracts top mentioned users", () => {
    const msgs = [
      makeMsg("m1", "alice", "@bob can you review?", 5),
      makeMsg("m2", "alice", "@bob @charlie thoughts?", 4),
    ];
    const result = summarizeConversation(msgs);
    expect(result.topMentioned[0]).toBe("bob");
  });

  it("sorts participants by message count", () => {
    const msgs = [
      makeMsg("m1", "alice", "a", 5),
      makeMsg("m2", "bob", "b", 4),
      makeMsg("m3", "alice", "c", 3),
      makeMsg("m4", "alice", "d", 2),
    ];
    const result = summarizeConversation(msgs);
    expect(result.participants[0].name).toBe("alice");
    expect(result.participants[0].messageCount).toBe(3);
  });

  it("calculates average message length", () => {
    const msgs = [
      makeMsg("m1", "alice", "hello", 5),     // 5 chars
      makeMsg("m2", "bob", "hi there!", 4),    // 9 chars
    ];
    const result = summarizeConversation(msgs);
    expect(result.avgMessageLength).toBe(7);
  });
});

describe("formatSummaryLine", () => {
  it("formats a readable summary", () => {
    const summary = summarizeConversation([
      makeMsg("m1", "alice", "hello", 30),
      makeMsg("m2", "bob", "hi", 25),
    ]);
    const line = formatSummaryLine(summary);
    expect(line).toContain("2 messages");
    expect(line).toContain("2 participants");
  });

  it("includes threads when present", () => {
    const summary = summarizeConversation([
      makeMsg("m1", "alice", "root", 10),
      makeMsg("m2", "bob", "reply", 9, { parentId: "m1" }),
    ]);
    const line = formatSummaryLine(summary);
    expect(line).toContain("1 threads");
  });
});
