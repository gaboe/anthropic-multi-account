# anthropic-multi-account

OpenCode plugin for managing multiple Anthropic Max subscription accounts with automatic failover based on rate limit utilization.

## Why?

Anthropic Max subscriptions have rate limits. If you have multiple accounts (e.g., 5x and 20x), this plugin automatically switches between them based on usage - keeping your primary account for as long as possible while failing over to the backup when needed.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Request Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Request  ──►  Check max-5x metrics  ──►  Route request   │
│                        │                        │           │
│                        ▼                        ▼           │
│               Any metric > 70%?         Use selected        │
│                   │       │              account            │
│                  YES      NO                 │              │
│                   │       │                  ▼              │
│                   ▼       ▼           Capture response      │
│              Use x20   Use x5          headers              │
│                                              │              │
│                                              ▼              │
│                                        Update usage         │
│                                        metrics              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Threshold Logic

| Condition | Action |
|-----------|--------|
| Any metric > **70%** on max-5x | Switch to max-20x |
| All metrics < **60%** on max-5x | Switch back to max-5x |
| Currently on max-20x | Check recovery every **1 hour** |

### Metrics Tracked

Anthropic sends these headers with every response (no extra API calls needed):

- `anthropic-ratelimit-unified-5h-utilization` - 5-hour rolling window
- `anthropic-ratelimit-unified-7d-utilization` - 7-day rolling window  
- `anthropic-ratelimit-unified-7d_sonnet-utilization` - 7-day Sonnet-specific

## Installation

### 1. Clone the repository

```bash
git clone git@github.com:gaboe/anthropic-multi-account.git
cd anthropic-multi-account
```

### 2. Symlink to OpenCode plugins

```bash
mkdir -p ~/.config/opencode/plugins
ln -s $(pwd) ~/.config/opencode/plugins/anthropic-multi-account
```

### 3. Disable default Anthropic plugin

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export OPENCODE_DISABLE_DEFAULT_PLUGINS=true
```

**Important**: Without this, the built-in Anthropic plugin will override the custom fetch wrapper.

### 4. Configure accounts

Edit `~/.local/share/opencode/auth.json`:

```json
{
  "anthropic": {
    "multiAccounts": {
      "accounts": [
        {
          "name": "max-5x",
          "sessionKey": "your-session-key-here"
        },
        {
          "name": "max-20x", 
          "sessionKey": "your-other-session-key-here"
        }
      ]
    }
  }
}
```

Session keys can be obtained from browser cookies when logged into console.anthropic.com.

### 5. Restart OpenCode

```bash
opencode
```

## Usage CLI

Check current usage across accounts:

```bash
bun src/usage.ts
```

Watch mode (refreshes every 5s):

```bash
bun src/usage.ts --watch
```

Output includes colored progress bars:
- 🟢 Green: < 50%
- 🟡 Yellow: 50-70%  
- 🔴 Red: > 70%

## Configuration

Constants in `src/index.mjs`:

```javascript
const THRESHOLD = 0.70;      // Switch TO x20 when ANY metric > 70%
const RECOVER = 0.60;        // Switch BACK when ALL metrics < 60%
const CHECK_INTERVAL = 3600000; // Check recovery every 1 hour
```

## Data Storage

All state is stored in `~/.local/share/opencode/auth.json` under `anthropic.multiAccounts`:

- `accounts` - Array of configured accounts with session keys
- `currentAccount` - Currently active account name
- `usage` - Per-account usage metrics with timestamps
- `requestCount` - Total requests made through the plugin

## License

MIT
