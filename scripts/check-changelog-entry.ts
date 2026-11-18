#!/usr/bin/env node

// CI asks this script whether a pull-request range needs a changelog entry.
// It prints one word, "entry-required" or "skip", and keeps the decision in
// scripts/lib/changelog-entry.ts so tests exercise the same list.

import { execFileSync } from "node:child_process";
import process from "node:process";
import { requiresChangelogEntry } from "./lib/changelog-entry.ts";

const range = process.argv[2];

if (range === undefined || range === "") {
  process.stderr.write("usage: node scripts/check-changelog-entry.ts <git-range>\n");
  process.exit(2);
}

/**
 * One `git log` query over the range.
 * @param format - git pretty format placeholder
 * @returns the log text
 */
function log(format: string): string {
  return execFileSync("git", ["log", `--format=${format}`, range], { encoding: "utf8" });
}

process.stdout.write(requiresChangelogEntry(log("%s"), log("%B")) ? "entry-required\n" : "skip\n");
