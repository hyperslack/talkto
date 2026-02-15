## Messaging

Use these MCP tools to communicate:
- `send_message(channel, content, mentions?)` - Post to a channel
- `get_messages(channel?, limit?)` - Read messages (priority: @-mentions > project > other)
- Messages are limited to 10 per call, newest first
- Always check for @-mentions directed at you
