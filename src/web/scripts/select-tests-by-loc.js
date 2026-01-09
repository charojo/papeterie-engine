#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * select-tests-by-loc.js
 * 
 * Reads git diff and .vitest-loc-map.json to determine which tests
 * cover the changed lines.
 * 
 * Usage:
 *   node scripts/select-tests-by-loc.js [--json]
 * 
 * Output:
 *   List of test files (one per line) or JSON array with --json flag
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const LOC_MAP_FILE = path.join(rootDir, '.vitest-loc-map.json');
const outputJson = process.argv.includes('--json');

/**
 * Parse git diff to extract changed files and line numbers
 * @returns {Array<{file: string, lines: number[]}>}
 */
function getChangedLines() {
    try {
        // Get unified diff with line numbers
        const diffOutput = execSync('git diff --unified=0 HEAD -- "src/**/*.js" "src/**/*.jsx"', {
            cwd: rootDir,
            encoding: 'utf-8'
        });

        const changes = [];
        let currentFile = null;
        let currentLines = [];

        for (const line of diffOutput.split('\n')) {
            // Match file header: +++ b/src/components/Foo.jsx
            const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
            if (fileMatch) {
                if (currentFile) {
                    changes.push({ file: currentFile, lines: currentLines });
                }
                currentFile = fileMatch[1];
                currentLines = [];
                continue;
            }

            // Match hunk header: @@ -10,5 +10,7 @@
            // The +X,Y means starting at line X, Y lines changed
            const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
            if (hunkMatch) {
                const startLine = parseInt(hunkMatch[1], 10);
                const lineCount = parseInt(hunkMatch[2] || '1', 10);

                for (let i = 0; i < lineCount; i++) {
                    currentLines.push(startLine + i);
                }
            }
        }

        // Don't forget the last file
        if (currentFile) {
            changes.push({ file: currentFile, lines: currentLines });
        }

        return changes;
    } catch {
        // No changes or git error
        return [];
    }
}

/**
 * Load LOC map from disk
 */
function loadLocMap() {
    try {
        if (fs.existsSync(LOC_MAP_FILE)) {
            return JSON.parse(fs.readFileSync(LOC_MAP_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('[select-tests-by-loc] Could not load LOC map:', e.message);
    }
    return {};
}

/**
 * Find tests that cover the changed lines
 * @param {Object} locMap - The LOC map
 * @param {Array<{file: string, lines: number[]}>} changes - Changed files and lines
 * @returns {Set<string>} Test files to run
 */
function findTestsForChanges(locMap, changes) {
    const testsToRun = new Set();

    for (const { file, lines } of changes) {
        const fileMap = locMap[file];
        if (!fileMap) {
            // No coverage data for this file - might be new or untested
            // In this case, we might want to run related tests heuristically
            continue;
        }

        for (const line of lines) {
            const tests = fileMap[String(line)];
            if (tests) {
                for (const test of tests) {
                    testsToRun.add(test);
                }
            }
        }
    }

    return testsToRun;
}

// Main
const changes = getChangedLines();
const locMap = loadLocMap();
const testsToRun = findTestsForChanges(locMap, changes);

if (outputJson) {
    console.log(JSON.stringify([...testsToRun]));
} else {
    if (testsToRun.size === 0) {
        console.log('# No tests found for changed lines');
        console.log('# Run with --full to include all tests');
    } else {
        for (const test of testsToRun) {
            console.log(test);
        }
    }
}

// Exit with appropriate code
process.exit(testsToRun.size > 0 ? 0 : 1);
