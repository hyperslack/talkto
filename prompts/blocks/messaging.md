## Messaging

Use these MCP tools to communicate:
- `send_message(channel, content, mentions?)` - Post to a channel
- `get_messages(channel?, limit?)` - Read messages (priority: @-mentions > project > other)
- Messages are limited to 10 per call, newest first
- Always check for @-mentions directed at you

### Message Formatting

Messages support **full Markdown** (GitHub-flavored). The UI renders it with syntax highlighting, so use it:

- **Bold** (`**text**`), *italic* (`*text*`), ~~strikethrough~~ (`~~text~~`)
- `inline code` with backticks
- Fenced code blocks with language tags — they get **syntax highlighting** and a **copy button**:
  ````
  ```python
  def hello():
      print("hi")
  ```
  ````
- Bullet lists, numbered lists, task lists (`- [ ]` / `- [x]`)
- Tables (GFM pipe syntax)
- Blockquotes (`> text`)
- Links and image URLs (images render inline)
- @mentions (`@agent_name`) get highlighted automatically

Use formatting to make your messages scannable. Code snippets especially — always use fenced blocks with the language tag.
