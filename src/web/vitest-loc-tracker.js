/* eslint-disable no-undef */
/**
 * Vitest LOC Tracker Plugin
 * 
 * Tracks which lines each test covers and stores mappings
 * for changeset-only test selection.
 * 
 * Storage: src/web/.vitest-loc-map.json
 * Format: { 
 *   "src/component.jsx": { 
 *     "42": ["__tests__/component.test.jsx"],
 *     "43": ["__tests__/component.test.jsx", "__tests__/other.test.jsx"] 
 *   }
 * }
 * 
 * Usage in vite.config.js:
 *   import locTracker from './vitest-loc-tracker.js';
 *   test: {
 *     plugins: [locTracker()],
 *     coverage: { ... }
 *   }
 */

import fs from 'fs';
import path from 'path';

const LOC_MAP_FILE = '.vitest-loc-map.json';

/**
 * Load existing LOC map or create empty one
 */
function loadLocMap(rootDir) {
    const mapPath = path.join(rootDir, LOC_MAP_FILE);
    try {
        if (fs.existsSync(mapPath)) {
            return JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
        }
    } catch (e) {
        console.warn('[vitest-loc-tracker] Could not load existing map:', e.message);
    }
    return {};
}

/**
 * Save LOC map to disk
 */
function saveLocMap(rootDir, locMap) {
    const mapPath = path.join(rootDir, LOC_MAP_FILE);
    try {
        fs.writeFileSync(mapPath, JSON.stringify(locMap, null, 2));
    } catch (e) {
        console.error('[vitest-loc-tracker] Could not save map:', e.message);
    }
}

/**
 * Extract covered lines from V8 coverage data
 * @param {Object} coverage - V8 coverage object
 * @returns {Map<string, Set<number>>} Map of file -> Set of covered line numbers
 */
function extractCoveredLines(coverage) {
    const fileLines = new Map();

    if (!coverage) return fileLines;

    for (const [filePath, fileData] of Object.entries(coverage)) {
        // Skip non-source files
        if (filePath.includes('node_modules') || filePath.includes('__tests__')) {
            continue;
        }

        const lines = new Set();

        // V8 coverage uses different structures - handle both istanbul and v8
        if (fileData.s) {
            // Istanbul format: s is statement map, statementMap has locations
            const stmtMap = fileData.statementMap || {};
            for (const [stmtId, count] of Object.entries(fileData.s)) {
                if (count > 0 && stmtMap[stmtId]) {
                    const loc = stmtMap[stmtId];
                    for (let line = loc.start.line; line <= loc.end.line; line++) {
                        lines.add(line);
                    }
                }
            }
        } else if (fileData.functions) {
            // V8 format: functions array with ranges
            for (const func of fileData.functions) {
                for (const range of func.ranges || []) {
                    if (range.count > 0 && range.startLine) {
                        for (let line = range.startLine; line <= (range.endLine || range.startLine); line++) {
                            lines.add(line);
                        }
                    }
                }
            }
        }

        if (lines.size > 0) {
            // Normalize path to be relative
            const relativePath = filePath.replace(/^.*?src\//, 'src/');
            fileLines.set(relativePath, lines);
        }
    }

    return fileLines;
}

/**
 * Vitest plugin for LOC tracking
 */
export default function vitestLocTracker(options = {}) {
    const rootDir = options.rootDir || process.cwd();
    let locMap = {};
    let currentTestFile = null;

    return {
        name: 'vitest-loc-tracker',

        /**
         * Called when vitest starts
         */
        configureServer() {
            // Load existing map at start
            locMap = loadLocMap(rootDir);
        },

        /**
         * Hook into vitest's test lifecycle
         * This is called by vitest's reporter system
         */
        reporter: {
            onTestFileStart(testFile) {
                currentTestFile = testFile;
            },

            onTestFileEnd(testFile, coverageData) {
                if (!coverageData) return;

                const testPath = testFile.replace(/^.*?src\//, 'src/');
                const coveredLines = extractCoveredLines(coverageData);

                // Update LOC map with this test's coverage
                for (const [filePath, lines] of coveredLines) {
                    if (!locMap[filePath]) {
                        locMap[filePath] = {};
                    }

                    for (const line of lines) {
                        const lineKey = String(line);
                        if (!locMap[filePath][lineKey]) {
                            locMap[filePath][lineKey] = [];
                        }
                        if (!locMap[filePath][lineKey].includes(testPath)) {
                            locMap[filePath][lineKey].push(testPath);
                        }
                    }
                }
            },

            onFinished() {
                // Save the complete map at the end
                saveLocMap(rootDir, locMap);
                console.log(`[vitest-loc-tracker] Saved LOC map with ${Object.keys(locMap).length} files`);
            }
        }
    };
}

/**
 * Utility to select tests based on changed lines
 * @param {string} rootDir - Project root
 * @param {Array<{file: string, lines: number[]}>} changes - Changed files with line numbers
 * @returns {Set<string>} Set of test files to run
 */
export function selectTestsForChanges(rootDir, changes) {
    const locMap = loadLocMap(rootDir);
    const testsToRun = new Set();

    for (const { file, lines } of changes) {
        const fileMap = locMap[file];
        if (!fileMap) continue;

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
