// A delta is tied to one exact installed version; unchanged offline assets stay in place.
export function deltaManifest(current,base) {
  if(current.app!=='TarkovOffline'||base.app!=='TarkovOffline'||current.version===base.version)throw Error('Invalid delta versions');
  const prior=new Map(base.files.map(f=>[f.path,f]));
  const files=current.files.filter(f=>{const old=prior.get(f.path);return !old||old.sha256!==f.sha256||old.size!==f.size;});
  const names=new Set(current.files.map(f=>f.path));
  const removed=base.files.filter(f=>!names.has(f.path)).map(f=>f.path);
  if(!files.some(f=>f.path==='package.json'))throw Error('A delta must include the new package version');
  return {format:2,app:'TarkovOffline',version:current.version,baseVersion:base.version,files,removed};
}
