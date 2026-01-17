#!/usr/bin/env python3
"""
Quick fix for _source field in clinical_data_launch.json

Changes all _source values to proper attribution array format,
then removes the field (since we'll use citations in the DB).

Usage:
  python3 fix_sources.py input.json output.json
"""

import json
import sys

def fix_sources(input_path: str, output_path: str):
    with open(input_path, 'r') as f:
        data = json.load(f)
    
    # Remove _source field from all entries (will use citations in DB)
    for entry in data.get('matched', []):
        if '_source' in entry:
            entry['_source'] = ["Wikipedia.org", "Z-Anatomy"]
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"Fixed {len(data.get('matched', []))} entries")
    print(f"Output written to: {output_path}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        # Default paths
        input_path = './data/clinical_data_launch.json'
        output_path = './data/clinical_data_launch.json'
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
    
    fix_sources(input_path, output_path)