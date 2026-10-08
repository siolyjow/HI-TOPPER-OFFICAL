// Legacy command retained for build scripts. No unprotected Fate runtime is copied into Hugo static.
import { rmSync } from 'node:fs';
rmSync(new URL('../static/fate/runtime/',import.meta.url),{recursive:true,force:true});
console.log('Private runtime is served only from Worker ASSETS through /lab/*/runtime/*');
