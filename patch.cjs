const fs = require('fs');
const path = './extension/shared/interaction-helpers.js';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/const conflictCountCache = new WeakMap\(\);\n\nfunction getHashCounts\(allInteractions\) \{[\s\S]*?return counts;\n\}/, `const conflictGroupCache = new WeakMap();

function getHashGroups(allInteractions) {
  let groups = conflictGroupCache.get(allInteractions);
  if (!groups) {
    groups = new Map();
    for (let i = 0; i < allInteractions.length; i++) {
      const h = allInteractions[i].hash;
      if (h) {
        let arr = groups.get(h);
        if (!arr) {
          arr = [];
          groups.set(h, arr);
        }
        arr.push(allInteractions[i]);
      }
    }
    conflictGroupCache.set(allInteractions, groups);
  }
  return groups;
}`);

code = code.replace(/export function getConflictCount\(interaction, allInteractions\) \{[\s\S]*?\n\}/, `export function getConflictCount(interaction, allInteractions) {
  if (!interaction || !interaction.hash || !allInteractions) return 0;
  const group = getHashGroups(allInteractions).get(interaction.hash);
  return group ? group.length : 0;
}

/**
 * Get conflicting versions.
 *
 * @param {Object} interaction - Interaction to check
 * @param {Array} allInteractions - All interactions to compare against
 * @returns {Array} Array of conflicting interactions
 */
export function getConflicts(interaction, allInteractions) {
  if (!interaction || !interaction.hash || !allInteractions) return [];
  return getHashGroups(allInteractions).get(interaction.hash) || [];
}`);

fs.writeFileSync(path, code);
