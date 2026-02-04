#!/usr/bin/env bun

import { generatePKCE } from "@openauthjs/openauth/pkce";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import * as readline from "readline";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTH_FILE = join(homedir(), ".local/share/opencode/auth.json");

function loadAuth() {
  if (!existsSync(AUTH_FILE)) return { anthropic: { multiAccounts: { accounts: [] } } };
  try {
    return JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
  } catch {
    return { anthropic: { multiAccounts: { accounts: [] } } };
  }
}

function saveAuth(data: any) {
  writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const accountName = process.argv[2];
  
  if (!accountName) {
    console.log("Usage: bun src/add-account.ts <account-name>");
    console.log("Example: bun src/add-account.ts max-5x");
    process.exit(1);
  }

  console.log(`\n🔐 Adding account: ${accountName}\n`);

  const pkce = await generatePKCE();
  
  const url = new URL("https://console.anthropic.com/oauth/authorize");
  url.searchParams.set("code", "true");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", "https://console.anthropic.com/oauth/code/callback");
  url.searchParams.set("scope", "org:create_api_key user:profile user:inference");
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", pkce.verifier);

  console.log("1. Open this URL in your browser:\n");
  console.log(`   ${url.toString()}\n`);
  console.log("2. Log in to your Anthropic Max account");
  console.log("3. After approval, you'll be redirected to a page showing a code");
  console.log("4. Copy the FULL URL from your browser's address bar\n");

  const callbackUrl = await prompt("Paste the callback URL here: ");

  let code: string;
  try {
    const parsed = new URL(callbackUrl);
    code = parsed.searchParams.get("code") || "";
    const state = parsed.searchParams.get("state") || "";
    if (code && state) {
      code = `${code}#${state}`;
    }
  } catch {
    code = callbackUrl;
  }

  if (!code) {
    console.error("\n❌ Could not extract code from URL");
    process.exit(1);
  }

  console.log("\n⏳ Exchanging code for tokens...");

  const splits = code.split("#");
  const response = await fetch("https://console.anthropic.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: splits[0],
      state: splits[1],
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: "https://console.anthropic.com/oauth/code/callback",
      code_verifier: pkce.verifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`\n❌ Token exchange failed: ${response.status}`);
    console.error(text);
    process.exit(1);
  }

  const json = await response.json() as { access_token: string; refresh_token: string; expires_in: number };

  const auth = loadAuth();
  if (!auth.anthropic) auth.anthropic = {};
  if (!auth.anthropic.multiAccounts) auth.anthropic.multiAccounts = { accounts: [] };
  if (!auth.anthropic.multiAccounts.accounts) auth.anthropic.multiAccounts.accounts = [];

  const existingIndex = auth.anthropic.multiAccounts.accounts.findIndex(
    (a: any) => a.name === accountName
  );

  const account = {
    name: accountName,
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
  };

  if (existingIndex >= 0) {
    auth.anthropic.multiAccounts.accounts[existingIndex] = account;
    console.log(`\n✅ Updated existing account: ${accountName}`);
  } else {
    auth.anthropic.multiAccounts.accounts.push(account);
    console.log(`\n✅ Added new account: ${accountName}`);
  }

  saveAuth(auth);
  console.log(`   Saved to ${AUTH_FILE}`);
  console.log("\n🎉 Done! Restart OpenCode to use the new account.\n");
}

main().catch(console.error);
