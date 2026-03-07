# Delivery

Push delivery via email (Resend) and Telegram. Pull interfaces (web dashboard, MCP) are documented separately.

## Email Delivery

**File**: `src/delivery/email.ts`

| Setting | Value |
|---------|-------|
| API | Resend (`https://api.resend.com/emails`) |
| From | `Coronagraph <briefings@coronagraph.dev>` |
| Auth | Bearer token via `RESEND_API_KEY` |
| Recipient | `EMAIL_TO` env var |

### Functions

| Function | Purpose |
|----------|---------|
| `sendEmail(to, subject, html)` | Low-level email send |
| `sendBriefEmail(title, content)` | Formats brief as HTML email |
| `sendAlertEmail(alerts)` | Formats alert batch as HTML email |

### Content processing

- `markdownToHtml(md)` converts markdown to HTML:
    - Headers (`#`, `##`, `###`) → `<h1>`, `<h2>`, `<h3>`
    - Bold (`**text**`) → `<strong>`
    - Italic (`*text*`) → `<em>`
    - Code (`` `code` ``) → `<code>`
    - Lists (`- item`) → `<li>`
    - Links (`[text](url)`) → `<a>`
- `wrapInHtmlTemplate(subject, body)` wraps content in a styled HTML template
- `escapeHtml(str)` sanitizes user content

### Alert email format

Each alert includes:

- Urgency badge (color-coded)
- Item title
- Reason for alerting
- Recommended action
- Link to source (if available)

### Graceful degradation

If `RESEND_API_KEY` or `EMAIL_TO` is not configured, email functions return `{ success: false }` without throwing.

## Telegram Delivery

**File**: `src/delivery/telegram.ts`

| Setting | Value |
|---------|-------|
| API | Telegram Bot API (`https://api.telegram.org/bot{token}/{method}`) |
| Auth | Token embedded in URL via `TELEGRAM_BOT_TOKEN` |
| Default chat | `TELEGRAM_CHAT_ID` env var |
| Message limit | 4,096 characters |
| Rate limiting | 300ms delay between messages |

### Functions

| Function | Purpose |
|----------|---------|
| `sendMessage(chatId, text, parseMode?)` | Low-level message send |
| `splitMessage(text)` | Split long text at 4096-char boundaries |
| `sendBrief(chatId, title, content)` | Send brief as title + chunked content |
| `sendAlertNotification(chatId, alerts)` | Send one message per alert |
| `sendToDefaultChat(text)` | Send to configured default chat |
| `sendBriefToDefaultChat(title, content)` | Brief to default chat |

### Message splitting

The `splitMessage` function splits long content at natural boundaries:

1. Try to split at paragraph breaks (`\n\n`)
2. Fall back to line breaks (`\n`)
3. Fall back to space boundaries
4. Hard cut at 4096 if no boundary found

### Brief delivery

Briefs are sent as multiple messages:

1. Title message with separator line
2. Content split into chunks at 4096-char boundaries
3. 300ms delay between each message to avoid rate limits

### Alert delivery

Each alert is sent as a separate message containing:

- Urgency emoji and level
- Item title
- Reason
- Recommended action
- Source URL (if available)

### Graceful degradation

If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is not configured, functions return `{ success: false }` without throwing.
