# anthropic-multi-account

OpenCode plugin for managing multiple Anthropic Max subscription accounts with automatic failover based on rate limit utilization.

## Why?

Anthropic Max subscriptions have rate limits. This plugin automatically switches between multiple accounts based on usage - keeping your primary account as long as possible while failing over to backups when needed.

**Works with any number of accounts** - 2x 5x, 3x 5x, 5x + 20x, etc.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Request Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Request  ──►  Check primary metrics  ──►  Route request  │
│                        │                        │           │
│                        ▼                        ▼           │
│               Any metric > 70%?         Use selected        │
│                   │       │              account            │
│                  YES      NO                 │              │
│                   │       │                  ▼              │
│                   ▼       ▼           Capture response      │
│            Use fallback  Use primary    headers             │
│                                              │              │
│                                              ▼              │
│                                        Update usage         │
│                                        metrics              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Account Priority

- **accounts[0]** = Primary (always preferred)
- **accounts[1..n]** = Fallbacks (in order of preference)

### Threshold Logic

| Condition | Action |
|-----------|--------|
| Primary > **70%** | Switch to first fallback < 70% |
| Primary < **60%** | Switch back to primary |
| On fallback | Check recovery every **1 hour** |

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

Use the add-account utility to authenticate each account:

```bash
# Add accounts (first = primary, rest = fallbacks)
bun src/add-account.ts primary
bun src/add-account.ts fallback1
bun src/add-account.ts fallback2  # optional - add as many as you want
```

Name accounts whatever you want - `work`, `personal`, `max-5x`, `backup`, etc.

The utility will:
1. Generate an OAuth authorization URL
2. You open it in browser and log in to your Anthropic Max account
3. After approval, copy the callback URL from browser
4. Paste it back - tokens are automatically saved

**Important**: Each account requires a **separate Anthropic Max subscription**. Log out and log in with different credentials for each account.

<details>
<summary>Manual configuration (advanced)</summary>

Tokens are stored in `~/.local/share/opencode/auth.json`:

```json
{
  "anthropic": {
    "multiAccounts": {
      "accounts": [
        {
          "name": "primary",
          "access": "your-access-token",
          "refresh": "your-refresh-token",
          "expires": 1234567890000
        }
      ]
    }
  }
}
```

Tokens are automatically refreshed when expired.
</details>

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
