
const fs=require('fs'),path=require('path');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const root=path.resolve(__dirname,'..'); let bad=0, count=0;
function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p);if(s.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(p) && !/\.d\.ts$/.test(p)){count++;const src=fs.readFileSync(p,'utf8');const out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true,fileName:p});const ds=(out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);if(ds.length){bad++;console.error('FAIL',path.relative(root,p));for(const d of ds)console.error(ts.flattenDiagnosticMessageText(d.messageText,' '));}}}}
walk(root);console.log(`${bad?'FAIL':'PASS'} - TypeScript syntax/transpile (${count} files)`);process.exit(bad?1:0);
