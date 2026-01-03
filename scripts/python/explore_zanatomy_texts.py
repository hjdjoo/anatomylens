"""
Z-Anatomy Text Datablock Exploration
Version 1.0 - Explore internal text files stored in the .blend file

PURPOSE:
Z-Anatomy stores rich descriptions as Blender Text datablocks,
accessible via bpy.data.texts (NOT bpy.data.objects).

These appear in the Scripting workspace text browser with an "f" icon.

RUN: In Blender with Z-Anatomy file loaded
OUTPUT: JSON report + console summary
"""

import bpy
import json
import os
import re
from collections import defaultdict
from typing import Dict, List, Any, Tuple

# ============================================================
# CONFIGURATION
# ============================================================

OUTPUT_DIR = os.path.expanduser("~/Code/bodyguide/data")
REPORT_FILENAME = "zanatomy_text_datablocks_report.json"

# ============================================================
# EXPLORATION FUNCTIONS
# ============================================================

def explore_text_datablocks():
    """
    Explore all text datablocks stored in the Blender file.
    """
    print("\n" + "=" * 70)
    print("Z-ANATOMY TEXT DATABLOCK EXPLORATION")
    print("=" * 70)
    
    texts = bpy.data.texts
    print(f"\nTotal text datablocks found: {len(texts)}")
    
    # Categorize texts
    categories = {
        'scripts': [],      # .py files
        'descriptions': [], # Anatomical descriptions
        'other': [],        # Everything else
    }
    
    all_texts = {}
    
    for text in texts:
        name = text.name
        content = text.as_string()
        line_count = len(text.lines)
        
        entry = {
            'name': name,
            'line_count': line_count,
            'char_count': len(content),
            'content_preview': content[:500] if content else '',
            'full_content': content,
        }
        
        # Categorize
        if name.endswith('.py'):
            categories['scripts'].append(name)
        elif line_count > 0 and not name.endswith('.py'):
            # Likely a description
            categories['descriptions'].append(name)
        else:
            categories['other'].append(name)
        
        all_texts[name] = entry
    
    print(f"\nCategories:")
    print(f"  Scripts (.py): {len(categories['scripts'])}")
    print(f"  Descriptions: {len(categories['descriptions'])}")
    print(f"  Other: {len(categories['other'])}")
    
    return all_texts, categories


def analyze_description_texts(all_texts: Dict, categories: Dict):
    """
    Deep analysis of description text blocks.
    """
    print("\n" + "-" * 50)
    print("ANALYZING DESCRIPTION TEXTS")
    print("-" * 50)
    
    descriptions = categories['descriptions']
    print(f"\nFound {len(descriptions)} potential description texts")
    
    # Sample some descriptions
    print("\n--- Sample Descriptions ---")
    
    samples = []
    for name in sorted(descriptions)[:20]:
        entry = all_texts[name]
        content = entry['full_content'].strip()
        
        sample = {
            'name': name,
            'lines': entry['line_count'],
            'chars': entry['char_count'],
            'preview': content[:300] if content else '(empty)',
        }
        samples.append(sample)
        
        print(f"\n  [{name}] ({entry['line_count']} lines, {entry['char_count']} chars)")
        preview = content[:200].replace('\n', ' ') if content else '(empty)'
        print(f"    \"{preview}...\"" if len(content) > 200 else f"    \"{preview}\"")
    
    return samples


def find_structure_mappings(all_texts: Dict, categories: Dict):
    """
    Try to map description texts to mesh structures.
    """
    print("\n" + "-" * 50)
    print("MAPPING DESCRIPTIONS TO STRUCTURES")
    print("-" * 50)
    
    # Get all mesh names from scene for comparison
    mesh_names = set()
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            # Store base name (without .l/.r suffix)
            base = obj.name
            for suffix in ['.l', '.r', '.g']:
                if base.endswith(suffix):
                    base = base[:-2]
                    break
            mesh_names.add(base.lower())
            mesh_names.add(obj.name.lower())
    
    print(f"Total mesh objects in scene: {len([o for o in bpy.data.objects if o.type == 'MESH'])}")
    print(f"Unique base mesh names: {len(mesh_names)}")
    
    # Try to match descriptions to meshes
    matched = []
    unmatched = []
    
    for name in categories['descriptions']:
        name_lower = name.lower()
        name_normalized = name_lower.replace(' ', '_').replace('-', '_')
        
        # Check for matches
        found_match = False
        for mesh_name in mesh_names:
            mesh_normalized = mesh_name.replace(' ', '_').replace('-', '_')
            if name_lower == mesh_name or name_normalized == mesh_normalized:
                matched.append({'text': name, 'mesh': mesh_name})
                found_match = True
                break
            # Partial match
            if name_lower in mesh_name or mesh_name in name_lower:
                matched.append({'text': name, 'mesh': mesh_name, 'partial': True})
                found_match = True
                break
        
        if not found_match:
            unmatched.append(name)
    
    print(f"\nMatched to meshes: {len(matched)}")
    print(f"Unmatched: {len(unmatched)}")
    
    if matched:
        print("\n--- Sample Matches ---")
        for m in matched[:10]:
            partial = " (partial)" if m.get('partial') else ""
            print(f"  {m['text']} → {m['mesh']}{partial}")
    
    if unmatched:
        print("\n--- Sample Unmatched ---")
        for u in unmatched[:10]:
            print(f"  {u}")
    
    return matched, unmatched


def analyze_content_structure(all_texts: Dict, categories: Dict):
    """
    Analyze the structure/format of description content.
    """
    print("\n" + "-" * 50)
    print("ANALYZING CONTENT STRUCTURE")
    print("-" * 50)
    
    # Look for patterns in the content
    patterns = {
        'has_origin': [],
        'has_insertion': [],
        'has_innervation': [],
        'has_blood': [],
        'has_function': [],
        'has_latin': [],
        'plain_description': [],
    }
    
    keywords = {
        'origin': ['origin', 'originates', 'arises from', 'attachment'],
        'insertion': ['insertion', 'inserts', 'attaches to'],
        'innervation': ['innervation', 'innervated', 'nerve', 'nervous'],
        'blood': ['blood supply', 'arterial', 'artery', 'vascular'],
        'function': ['function', 'action', 'movement', 'flexion', 'extension'],
        'latin': ['latin:', 'terminologia', 'ta:'],
    }
    
    for name in categories['descriptions']:
        content = all_texts[name]['full_content'].lower()
        
        for keyword_category, kws in keywords.items():
            if any(kw in content for kw in kws):
                pattern_key = f'has_{keyword_category}'
                if pattern_key in patterns:
                    patterns[pattern_key].append(name)
    
    # Count plain descriptions (no special keywords)
    all_desc_names = set(categories['descriptions'])
    matched_any = set()
    for names in patterns.values():
        matched_any.update(names)
    patterns['plain_description'] = list(all_desc_names - matched_any)
    
    print("\nContent patterns found:")
    for pattern, names in patterns.items():
        print(f"  {pattern}: {len(names)}")
    
    return patterns


def export_all_descriptions(all_texts: Dict, categories: Dict):
    """
    Export all descriptions to a structured JSON file.
    """
    print("\n" + "-" * 50)
    print("EXPORTING DESCRIPTIONS")
    print("-" * 50)
    
    export_data = {
        'metadata': {
            'total_texts': len(all_texts),
            'total_descriptions': len(categories['descriptions']),
            'source': 'Z-Anatomy Blender Text Datablocks',
        },
        'descriptions': {},
        'scripts': categories['scripts'],
        'other': categories['other'],
    }
    
    for name in categories['descriptions']:
        entry = all_texts[name]
        export_data['descriptions'][name] = {
            'content': entry['full_content'],
            'line_count': entry['line_count'],
            'char_count': entry['char_count'],
        }
    
    # Save full export
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, REPORT_FILENAME)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Exported to: {output_path}")
    
    # Also save a simpler mapping file
    simple_mapping = {}
    for name in categories['descriptions']:
        simple_mapping[name] = all_texts[name]['full_content']
    
    simple_path = os.path.join(OUTPUT_DIR, "zanatomy_descriptions.json")
    with open(simple_path, 'w', encoding='utf-8') as f:
        json.dump(simple_mapping, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Simple mapping exported to: {simple_path}")
    
    return export_data


# ============================================================
# MAIN
# ============================================================

def main():
    print("\n" + "=" * 70)
    print("Z-ANATOMY TEXT DATABLOCK EXPLORATION v1.0")
    print("=" * 70)
    print("\nExploring bpy.data.texts for internal description files...")
    
    # Explore all text datablocks
    all_texts, categories = explore_text_datablocks()
    
    # Analyze descriptions
    samples = analyze_description_texts(all_texts, categories)
    
    # Try to map to structures
    matched, unmatched = find_structure_mappings(all_texts, categories)
    
    # Analyze content structure
    patterns = analyze_content_structure(all_texts, categories)
    
    # Export everything
    export_data = export_all_descriptions(all_texts, categories)
    
    # Summary
    print("\n" + "=" * 70)
    print("EXPLORATION COMPLETE")
    print("=" * 70)
    print(f"\n  Total text datablocks: {len(all_texts)}")
    print(f"  Description texts: {len(categories['descriptions'])}")
    print(f"  Matched to meshes: {len(matched)}")
    print(f"\nFiles exported:")
    print(f"  - zanatomy_text_datablocks_report.json (full report)")
    print(f"  - zanatomy_descriptions.json (simple name→content mapping)")
    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
