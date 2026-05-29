const fs = require('fs');
const path = './extension/shared/app.js';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /import \{ getConflictCount \} from '\.\/interaction-helpers\.js';/,
  "import { getConflictCount, getConflicts } from './interaction-helpers.js';"
);

code = code.replace(
  /const conflicts = selected \? state\.interactions\.filter\(i => i\.hash === selected\.hash\) : \[\];/,
  "const conflicts = selected ? getConflicts(selected, state.interactions) : [];"
);

fs.writeFileSync(path, code);
