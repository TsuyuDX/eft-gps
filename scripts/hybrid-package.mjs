// Source checkouts retain everything. Only distributable packages omit optional content.
export function hybridFiles(files,catalog){
 const optional=new Set(catalog.files.map(f=>'public/'+f.path));
 return files.filter(f=>!optional.has(f.path)&&!/^public\/data\/(?:en\/)?(?:source|tiles-cache)\//.test(f.path));
}
