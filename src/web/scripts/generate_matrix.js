
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const coverageDir = path.join(__dirname, '..', '.nyc_output');
const outputDir = path.join(__dirname, '..', '..', '..', 'logs');
// Output JSON for merging
const jsonOutputFile = path.join(outputDir, 'frontend_matrix.json');

const files = fs.readdirSync(coverageDir).filter(f => f.endsWith('.json'));
const matrix = {}; // { TestName: { ModulePath: Percentage } }

files.forEach(file => {
    let testName = file.replace(/^coverage-/, '').replace(/\.json$/, '');
    testName = testName.replace(/_/g, ' ');

    try {
        const content = fs.readFileSync(path.join(coverageDir, file), 'utf8');
        const coverage = JSON.parse(content);

        matrix[testName] = {};

        Object.keys(coverage).forEach(filePath => {
            const fileCov = coverage[filePath];
            const statementMap = fileCov.s;
            const statementCounts = Object.values(statementMap);
            const totalStatements = statementCounts.length;
            const coveredStatements = statementCounts.filter(c => c > 0).length;

            if (coveredStatements > 0) {
                // Make path relative to src/web
                const relativePath = filePath.split('src/web/')[1] || filePath;
                const percent = totalStatements > 0 ? (coveredStatements / totalStatements * 100) : 0;
                matrix[testName][relativePath] = parseFloat(percent.toFixed(2));
            }
        });

    } catch (e) {
        console.warn(`Failed to process ${file}:`, e.message);
    }
});

fs.writeFileSync(jsonOutputFile, JSON.stringify(matrix, null, 2));
console.log(`Frontend Matrix JSON generated at: ${jsonOutputFile}`);
