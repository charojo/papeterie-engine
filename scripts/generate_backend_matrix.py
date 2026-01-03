
import sqlite3
import json
import os
import sys

# Path to .coverage database (usually in root)
DB_PATH = '.coverage'
OUTPUT_FILE = 'logs/backend_matrix.json'

def generate_matrix():
    if not os.path.exists(DB_PATH):
        print(f"Coverage database not found at {DB_PATH}")
        return

    print(f"Processing backend coverage from {DB_PATH}...")
    
    # Connect to the coverage sqlite database
    # coverage.py 5.0+ stores data in sqlite
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Schema typically includes:
    # context: { id, context } (context is the test name if dynamic_context is set)
    # file: { id, path }
    # line_bits: { file_id, context_id, num_bits, bitmap } (This might vary by version, often it's 'line_map' or similar)
    # Actually, coverage.py 7.x schema is slightly different.
    # It usually has tables: 'coverage_schema', 'meta', 'file', 'context', 'line_bits' (or 'line')

    try:
        # Get all contexts (tests)
        cursor.execute("SELECT id, context FROM context WHERE context != ''")
        contexts = {row[0]: row[1] for row in cursor.fetchall()}

        # Get all files
        cursor.execute("SELECT id, path FROM file")
        files = {row[0]: row[1] for row in cursor.fetchall()}

        # We need to calculate per-file coverage for each context.
        # This is tricky without using the coverage API, but we'll try to use the raw stats if possible
        # or better, use the coverage API if installed.
        pass
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        conn.close()
        return

    conn.close()

    # RE-STRATEGY: Using raw SQL is fragile across versions. 
    # Let's use the coverage API.
    
    try:
        import coverage
    except ImportError:
        print("coverage module not installed.")
        return

    cov = coverage.Coverage(data_file=DB_PATH)
    cov.load()
    
    cov_data = cov.get_data()

    # Data structure: { "test_name": { "module": percent } }
    matrix = {}

    # cov_data.measured_contexts() returns list of context names
    for context in cov_data.measured_contexts():
        if not context: continue # Skip empty context
        
        # We need to scope the data to this context
        # coverage API doesn't make it super easy to ask "what is covered by this context only"
        # cleanly without manipulating internal state or creating a new coverage object with specific data.
        # However, cov.data has methods.
        
        matrix[context] = {}
        
        # This part is computationally expensive if loop over all files.
        # Ensure we only check files relevant to src
        
        for file_path in cov_data.measured_files():
            if 'src' not in file_path and 'papeterie-engine/src' not in file_path:
                continue
                
            # Relative path for readability
            rel_path = os.path.relpath(file_path, os.getcwd())
            if rel_path.startswith('..'): continue 

            # Get lines executed in this context
            try:
                # measured_lines(file_path, context=context) ? No, that's not the API
                # cov.data.lines(file_path, context=context) ??
                # Actually, cov.data.contexts_by_lineno(file_path) returns { lineno: [contexts] }
                # Inverting this is better?
                pass
            except Exception:
                pass

    # Efficient approach:
    # Iterate over all files, get contexts_by_lineno.
    # Aggregate stats per context.
    
    context_stats = {} # context -> { file -> { executed_lines: set(), total_lines: int } }

    for file_path in cov_data.measured_files():
        if 'src' not in file_path and 'papeterie-engine/src' not in file_path:
            continue
            
        rel_path = os.path.relpath(file_path, os.getcwd())
        
        # Get executable lines (total lines)
        # We need an analysis of the file to know total executable lines.
        # cov.analysis(file_path) returns (filename, executable_statements, excluded_statements, missing_statements, missing_formatted)
        # But cov.analysis checks general measured data, not context specific.
        # Total executable lines is constant regardless of context.
        
        try:
            analysis = cov._analyze(file_path) # Internal API, or use public
            executable_lines = set(analysis.statements)
            total_lines = len(executable_lines)
            
            if total_lines == 0: continue

            contexts_by_lineno = cov_data.contexts_by_lineno(file_path)
            
            # Map context -> executed lines count for this file
            file_context_counts = {}
            
            for lineno, contexts in contexts_by_lineno.items():
                if lineno not in executable_lines: continue
                
                for ctx in contexts:
                    if ctx not in file_context_counts:
                        file_context_counts[ctx] = 0
                    file_context_counts[ctx] += 1
            
            # Update global stats
            for ctx, count in file_context_counts.items():
                if ctx not in matrix:
                    matrix[ctx] = {}
                
                percent = (count / total_lines) * 100
                matrix[ctx][rel_path] = round(percent, 2)

        except Exception as e:
            # print(f"Error analyzing {rel_path}: {e}")
            pass

    # Ensure output dir
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(matrix, f, indent=2)
        
    print(f"Backend matrix generated at {OUTPUT_FILE}")

if __name__ == '__main__':
    generate_matrix()
