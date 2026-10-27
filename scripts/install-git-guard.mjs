import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function git(args,optional=false) {
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});
  if(result.status!==0&&!(optional&&result.status===1))throw Error((result.stderr||'Git is unavailable').trim());
  return (result.stdout||'').trim();
}
try {
  if(git(['config','--get','core.hooksPath'],true))throw Error('A custom hooksPath is configured. Existing hooks were left unchanged.');
  const target=path.resolve(root,git(['rev-parse','--git-path','hooks/pre-commit']));
  const content=fs.readFileSync(path.join(root,'.githooks','pre-commit'));
  if(fs.existsSync(target)&&!fs.readFileSync(target).equals(content))throw Error('An existing pre-commit hook was left unchanged.');
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,content);fs.chmodSync(target,0o755);
  console.log('Local EFT GPS branch guard installed. Stable main is protected from accidental commits.');
} catch(error) {console.error(error.message);process.exitCode=1;}
