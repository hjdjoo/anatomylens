#!/usr/bin/env node
/**
 * GLB Mesh Center Debugger
 * 
 * This script analyzes the glTF/GLB file to identify structures with
 * center mismatches between metadata and computed world positions.
 * 
 * Usage:
 *   node scripts/debug_mesh_centers.cjs [structure_name_filter]
 * 
 * Examples:
 *   node scripts/debug_mesh_centers.cjs                    # All structures
 *   node scripts/debug_mesh_centers.cjs inguinal          # Filter by name
 *   node scripts/debug_mesh_centers.cjs --mismatches-only # Only show mismatches
 */

const fs = require('fs');
const path = require('path');

// Configuration
const GLB_PATH = './public/models/torso.glb';
const METADATA_PATH = './public/models/torso_metadata.json';
const MISMATCH_THRESHOLD = 0.05; // 5cm threshold for flagging mismatches

// Parse arguments
const args = process.argv.slice(2);
const nameFilter = args.find(a => !a.startsWith('--'))?.toLowerCase() || '';
const mismatchesOnly = args.includes('--mismatches-only');

// ============================================================
// Matrix Math Utilities
// ============================================================

function quatToMatrix(q) {
  const [x, y, z, w] = q;
  return [
    1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w, 0,
    2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w, 0,
    2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y, 0,
    0, 0, 0, 1
  ];
}

function multiplyMatrices(a, b) {
  const result = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        result[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
      }
    }
  }
  return result;
}

function buildLocalMatrix(node) {
  let matrix = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  
  if (node.matrix) return node.matrix;
  
  if (node.scale) {
    const [sx, sy, sz] = node.scale;
    matrix = [sx,0,0,0, 0,sy,0,0, 0,0,sz,0, 0,0,0,1];
  }
  
  if (node.rotation) {
    const rotMatrix = quatToMatrix(node.rotation);
    matrix = multiplyMatrices(rotMatrix, matrix);
  }
  
  if (node.translation) {
    const [tx, ty, tz] = node.translation;
    const transMatrix = [1,0,0,0, 0,1,0,0, 0,0,1,0, tx,ty,tz,1];
    matrix = multiplyMatrices(transMatrix, matrix);
  }
  
  return matrix;
}

function getWorldMatrix(nodeIdx, gltf, childToParent, cache = {}) {
  if (cache[nodeIdx]) return cache[nodeIdx];
  
  const node = gltf.nodes[nodeIdx];
  const localMatrix = buildLocalMatrix(node);
  
  const parentIdx = childToParent[nodeIdx];
  if (parentIdx !== undefined) {
    const parentWorld = getWorldMatrix(parentIdx, gltf, childToParent, cache);
    cache[nodeIdx] = multiplyMatrices(parentWorld, localMatrix);
  } else {
    cache[nodeIdx] = localMatrix;
  }
  
  return cache[nodeIdx];
}

function getTranslation(matrix) {
  return [matrix[12], matrix[13], matrix[14]];
}

function vectorDistance(a, b) {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

function formatVector(v) {
  return `[${v.map(x => x.toFixed(4)).join(', ')}]`;
}

// ============================================================
// Main Analysis
// ============================================================

function main() {
  console.log('GLB Mesh Center Debugger');
  console.log('='.repeat(60));
  
  // Check files exist
  if (!fs.existsSync(GLB_PATH)) {
    console.error(`Error: GLB file not found at ${GLB_PATH}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(METADATA_PATH)) {
    console.error(`Error: Metadata file not found at ${METADATA_PATH}`);
    process.exit(1);
  }
  
  // Load GLB
  const buffer = fs.readFileSync(GLB_PATH);
  const magic = buffer.toString('ascii', 0, 4);
  
  if (magic !== 'glTF') {
    console.error('Error: Invalid GLB file');
    process.exit(1);
  }
  
  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonData = buffer.toString('utf8', 20, 20 + jsonChunkLength);
  const gltf = JSON.parse(jsonData);
  
  // Load metadata
  const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
  
  console.log(`Loaded ${gltf.nodes.length} nodes from GLB`);
  console.log(`Loaded ${Object.keys(metadata.structures).length} structures from metadata`);
  console.log(`Metadata version: ${metadata.version || '1.0'}`);
  
  if (nameFilter) {
    console.log(`Filtering by name: "${nameFilter}"`);
  }
  
  if (mismatchesOnly) {
    console.log(`Showing only structures with center mismatches > ${MISMATCH_THRESHOLD}m`);
  }
  
  console.log('='.repeat(60));
  console.log();
  
  // Build parent-child hierarchy
  const childToParent = {};
  gltf.nodes.forEach((node, idx) => {
    if (node.children) {
      node.children.forEach(childIdx => {
        childToParent[childIdx] = idx;
      });
    }
  });
  
  // Analyze each mesh node
  let totalAnalyzed = 0;
  let totalMismatches = 0;
  const matrixCache = {};
  
  gltf.nodes.forEach((node, idx) => {
    if (!node.name) return;
    if (node.mesh === undefined) return; // Skip non-mesh nodes
    
    // Apply name filter
    if (nameFilter && !node.name.toLowerCase().includes(nameFilter)) {
      return;
    }
    
    const meta = metadata.structures[node.name];
    if (!meta) {
      if (!mismatchesOnly) {
        console.log(`[WARN] No metadata for: ${node.name}`);
      }
      return;
    }
    
    totalAnalyzed++;
    
    // Compute world position from hierarchy
    const worldMatrix = getWorldMatrix(idx, gltf, childToParent, matrixCache);
    const worldPos = getTranslation(worldMatrix);
    
    // Compare with metadata
    const metadataCenter = meta.center;
    const distance = vectorDistance(worldPos, metadataCenter);
    const hasMismatch = distance > MISMATCH_THRESHOLD;
    
    if (hasMismatch) totalMismatches++;
    
    // Skip if only showing mismatches and this isn't one
    if (mismatchesOnly && !hasMismatch) {
      return;
    }
    
    // Print analysis
    console.log(`Structure: ${node.name}`);
    console.log(`  Type: ${meta.type}`);
    
    // Show hierarchy
    const parentIdx = childToParent[idx];
    if (parentIdx !== undefined) {
      const parentNode = gltf.nodes[parentIdx];
      console.log(`  ⚠️  Parent: ${parentNode.name} (Node ${parentIdx})`);
      console.log(`     Parent translation: ${formatVector(parentNode.translation || [0,0,0])}`);
    } else {
      console.log(`  Parent: Scene root`);
    }
    
    // Show transforms
    if (node.translation) {
      console.log(`  Local translation: ${formatVector(node.translation)}`);
    }
    if (node.rotation) {
      console.log(`  Local rotation: ${formatVector(node.rotation)}`);
    }
    if (node.scale) {
      console.log(`  Local scale: ${formatVector(node.scale)}`);
    }
    
    // Show center comparison
    console.log(`  Computed world pos: ${formatVector(worldPos)}`);
    console.log(`  Metadata center:    ${formatVector(metadataCenter)}`);
    
    if (hasMismatch) {
      console.log(`  ❌ MISMATCH: ${distance.toFixed(4)}m difference`);
    } else {
      console.log(`  ✓ Match (${distance.toFixed(4)}m difference)`);
    }
    
    console.log();
  });
  
  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total structures analyzed: ${totalAnalyzed}`);
  console.log(`Structures with mismatches: ${totalMismatches}`);
  console.log(`Structures OK: ${totalAnalyzed - totalMismatches}`);
  
  if (totalMismatches > 0) {
    console.log();
    console.log('Structures with mismatches are likely parented in Blender.');
    console.log('Run export_torso_v2.py to fix this by unparenting before export.');
  }
}

main();
