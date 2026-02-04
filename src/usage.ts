#!/usr/bin/env bun

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const AUTH_FILE = process.env.AUTH_FILE || join(homedir(), ".local/share/opencode/auth.json");

// Read auth.json
function loadAuth() {
  try {
    const data = JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
    return data.anthropic?.multiAccounts;
  } catch (e) {
    console.error("Error reading auth file:", e.message);
    process.exit(1);
  }
}

// Format progress bar (50 chars)
function progressBar(utilization: number): string {
  const percentage = Math.round(utilization * 100);
  const filled = Math.floor(percentage / 2); // 50 chars = 100%
  const halfBlock = (percentage % 2 === 1) ? '▌' : '';
  const empty = 50 - filled - (halfBlock ? 1 : 0);
  return '█'.repeat(filled) + halfBlock + ' '.repeat(Math.max(0, empty));
}

// Format reset time
function formatResetTime(unixTimestamp: number | null): string {
  if (!unixTimestamp) return "Unknown";
  const date = new Date(unixTimestamp * 1000);
  return new Intl.DateTimeFormat('default', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);
}

// Main
const multi = loadAuth();
if (!multi?.accounts?.length) {
  console.log("No multi-account configuration found");
  process.exit(0);
}

for (const account of multi.accounts) {
  console.log(`\nAccount: ${account.name}`);
  
  const usage = multi.usage?.[account.name];
  if (!usage) {
    console.log("  No usage data yet (will populate on first API request)");
    continue;
  }
  
  // Session (5h)
  console.log(`  Current session`);
  const sessionPct = Math.round((usage.session5h?.utilization || 0) * 100);
  console.log(`  ${progressBar(usage.session5h?.utilization || 0)}  ${sessionPct}% used`);
  console.log(`  Resets ${formatResetTime(usage.session5h?.reset)}`);
  
  // Weekly (all)
  console.log(`\n  Current week (all models)`);
  const weeklyPct = Math.round((usage.weekly7d?.utilization || 0) * 100);
  console.log(`  ${progressBar(usage.weekly7d?.utilization || 0)}  ${weeklyPct}% used`);
  console.log(`  Resets ${formatResetTime(usage.weekly7d?.reset)}`);
  
  // Weekly (Sonnet)
  console.log(`\n  Current week (Sonnet only)`);
  const sonnetPct = Math.round((usage.weekly7dSonnet?.utilization || 0) * 100);
  console.log(`  ${progressBar(usage.weekly7dSonnet?.utilization || 0)}  ${sonnetPct}% used`);
  console.log(`  Resets ${formatResetTime(usage.weekly7dSonnet?.reset)}`);
}
