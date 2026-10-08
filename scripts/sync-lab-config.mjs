// One source of truth for the public Lab brand, catalog, home and purchase link.
// Retains legacy Fate identifier/metadata keys in all connected systems.
import { existsSync,readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const siteRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const packageRoot=resolve(siteRoot,'..');
const fullPackage=existsSync(resolve(packageRoot,'backend/game'));
const root=fullPackage?packageRoot:siteRoot;
const configPath=fullPackage?resolve(packageRoot,'config/lab.json'):resolve(siteRoot,'lab-config.json');
const config=JSON.parse(readFileSync(configPath,'utf8'));
if(!config.brand||!config.service||config.home!=='/lab/'||config.games?.length!==5)throw Error('Invalid Lab shared config');
if(new Set(config.games.map(g=>g.slug)).size!==5)throw Error('Duplicate game slug');
const buy=new URL(config.purchase_url);
const productId=Number(buy.searchParams.get('fate-buy'));
if(buy.protocol!=='https:'||buy.hostname!=='j.hitopper.top'||!Number.isSafeInteger(productId)||productId<1)throw Error('Invalid Woo purchase mapping');
const appUrl='https://www.hitopper.top'+config.home;
function writeAt(base,rel,data){const p=resolve(base,rel);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,data)}
const serialized=JSON.stringify(config,null,2)+'\n';
writeAt(siteRoot,'data/lab.json',serialized);
writeAt(siteRoot,'static/lab/config.json',serialized);
if(fullPackage){
 writeAt(siteRoot,'lab-config.json',serialized);
 writeAt(root,'backend/game/src/lab-config.js','export const LAB_CONFIG = '+JSON.stringify(config,null,2)+';\n');
 const workerConfig=resolve(root,'backend/game/wrangler.jsonc');
 const worker=JSON.parse(readFileSync(workerConfig,'utf8'));worker.vars.PUBLIC_APP_URL=appUrl;
 writeAt(root,'backend/game/wrangler.jsonc',JSON.stringify(worker,null,2)+'\n');
 const phpPath='backend/game/integrations/woocommerce/fate-arbiter-woocommerce.php';
 let php=readFileSync(resolve(root,phpPath),'utf8');
 for(const [pattern,value] of [[/const BUY_PRODUCT_ID = \d+;/,`const BUY_PRODUCT_ID = ${productId};`],[/const GAME_ENTRY_URL = 'https:\/\/[^']+';/,`const GAME_ENTRY_URL = '${appUrl}';`]]){
  if(!pattern.test(php))throw Error('Woo config anchor missing: '+pattern);php=php.replace(pattern,value);
 }
 writeAt(root,phpPath,php);
 console.log('Lab shared config synchronized (standalone site + Worker + Woo mapping); no external calls');
}else{
 console.log('Lab shared config synchronized (standalone site only); no external calls');
}
