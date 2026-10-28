using System;
using System.IO;
using System.IO.Compression;
using System.Collections.Generic;
using System.Text;
using System.Web.Script.Serialization;
class NativeUpdateTest {
    static void Check(bool value,string message) {if(!value) throw new Exception(message);}
    static void Reject(Action action,string message) {bool rejected=false;try {action();} catch(IOException) {rejected=true;}Check(rejected,message);}
    static string Package(string fixture,string name,string version,string content,bool badPath,string baseVersion=null,string[] removed=null) {
        string zip=Path.Combine(fixture,name+".zip");var files=new List<ReleaseFile>();
        using(var archive=ZipFile.Open(zip,ZipArchiveMode.Create)) {
            foreach(string relative in baseVersion==null?new[]{"Tarkov Offline.exe","EFT GPS.exe","server.mjs","public/index.html","package.json"}:new[]{"package.json","public/index.html"}) {
                string value=relative=="package.json"?"{\"version\":\""+version+"\"}":content;
                string temp=Path.Combine(fixture,"hash-input");File.WriteAllText(temp,value,new UTF8Encoding(false));
                files.Add(new ReleaseFile{path=relative,size=new FileInfo(temp).Length,sha256=PackageInstaller.Hash(temp)});
                var entry=archive.CreateEntry(relative);using(var source=File.OpenRead(temp))using(var target=entry.Open())source.CopyTo(target);
            }
            if(badPath) using(var writer=new StreamWriter(archive.CreateEntry("../userdata/profile.json").Open()))writer.Write("bad");
            using(var writer=new StreamWriter(archive.CreateEntry("release.json").Open()))writer.Write(new JavaScriptSerializer().Serialize(new ReleaseInfo{format=baseVersion==null?1:2,app="TarkovOffline",version=version,baseVersion=baseVersion,removed=removed,files=files.ToArray()}));
        }
        return zip;
    }
    static int Main(string[] args) {
        AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling",false);
        AppContext.SetSwitch("Switch.System.IO.BlockLongPaths",false);
        string fixture=Path.GetFullPath(args[0]);Directory.CreateDirectory(fixture);
        string target=Path.Combine(fixture,"chosen install folder");
        string first=Package(fixture,"first","1.7.0","old",false),next=Package(fixture,"next","1.8.0","new",false);
        string stage=Path.Combine(fixture,"stage-first");var release=PackageInstaller.Stage(first,stage,delegate{});PackageInstaller.Install(target,stage,release,delegate{});
        Directory.CreateDirectory(Path.Combine(target,"userdata"));File.WriteAllText(Path.Combine(target,"userdata","profile.json"),"keep progress");
        File.WriteAllText(Path.Combine(target,"userdata","window-settings.json"),"keep settings");
        PackageInstaller.CheckUpdateHash(next,PackageInstaller.Hash(next));
        Reject(()=>PackageInstaller.CheckUpdateHash(next,new String('0',64)),"Bad hash accepted");
        stage=Path.Combine(fixture,"stage-next");release=PackageInstaller.Stage(next,stage,delegate{});
        PackageInstaller.CheckUpdateVersion(target,release,"1.8.0");
        Reject(()=>PackageInstaller.CheckUpdateVersion(target,release,"1.9.0"),"Wrong advertised version accepted");
        // File locking must roll back files already replaced in the same transaction.
        using(var locked=File.Open(Path.Combine(target,"public","index.html"),FileMode.Open,FileAccess.ReadWrite,FileShare.None))
            Reject(()=>PackageInstaller.Install(target,stage,release,delegate{}),"Locked file accepted");
        Check(File.ReadAllText(Path.Combine(target,"server.mjs"))=="old","Rollback failed");
        PackageInstaller.Install(target,stage,release,delegate{});
        Check(File.ReadAllText(Path.Combine(target,"public","index.html"))=="new","Update not applied to selected folder");
        Check(File.ReadAllText(Path.Combine(target,"userdata","profile.json"))=="keep progress","Progress changed");
        Check(File.ReadAllText(Path.Combine(target,"userdata","window-settings.json"))=="keep settings","Settings changed");
        Reject(()=>PackageInstaller.CheckUpdateVersion(target,release,"1.8.0"),"Same version accepted");
        Reject(()=>PackageInstaller.Stage(Package(fixture,"traversal","1.9.0","bad",true),Path.Combine(fixture,"bad-stage"),delegate{}),"Traversal accepted");
        string untouched=Path.Combine(target,"server.mjs");var before=File.GetLastWriteTimeUtc(untouched);
        File.WriteAllText(Path.Combine(target,"obsolete.txt"),"old asset");
        stage=Path.Combine(fixture,"delta-stage");int reported=0,last=0;
        var delta=PackageInstaller.Stage(Package(fixture,"delta","1.8.1","delta",false,"1.8.0",new[]{"obsolete.txt"}),stage,delegate{},delegate(InstallStatus value){Check(value.percent>=last,"Stage progress decreased");last=value.percent;reported++;});
        string installedPackage=File.ReadAllText(Path.Combine(target,"package.json"));File.WriteAllText(Path.Combine(target,"package.json"),"{\"version\":\"1.7.0\"}");
        Reject(()=>PackageInstaller.Install(target,stage,delta,delegate{}),"Wrong delta base accepted");File.WriteAllText(Path.Combine(target,"package.json"),installedPackage);
        using(var locked=File.Open(Path.Combine(target,"public","index.html"),FileMode.Open,FileAccess.ReadWrite,FileShare.None))Reject(()=>PackageInstaller.Install(target,stage,delta,delegate{}),"Locked delta accepted");
        Check(File.Exists(Path.Combine(target,"obsolete.txt")),"Removed file not restored on rollback");
        PackageInstaller.Install(target,stage,delta,delegate{},delegate(InstallStatus value){Check(value.percent>=last,"Install progress decreased");last=value.percent;reported++;});
        Check(reported>0&&last==99,"Determinate progress was not reported");
        Check(!File.Exists(Path.Combine(target,"obsolete.txt")),"Obsolete file retained");
        Check(File.ReadAllText(untouched)=="new"&&File.GetLastWriteTimeUtc(untouched)==before,"Delta touched unchanged file");
        var combined=new JavaScriptSerializer().Deserialize<ReleaseInfo>(File.ReadAllText(Path.Combine(target,"release.json")));
        Check(combined.format==1&&combined.version=="1.8.1"&&combined.files.Length==5,"Installed inventory was not merged");
        Check(File.ReadAllText(Path.Combine(target,"userdata","profile.json"))=="keep progress","Delta changed progress");
        stage=Path.Combine(fixture,"cancel-stage");var cancelRelease=PackageInstaller.Stage(Package(fixture,"cancel","1.8.2","cancelled",false),stage,delegate{});
        var cancellation=new System.Threading.CancellationTokenSource();bool cancelled=false;
        try{PackageInstaller.Install(target,stage,cancelRelease,delegate{},delegate(InstallStatus value){if(value.done>=2)cancellation.Cancel();},cancellation.Token);}catch(OperationCanceledException){cancelled=true;}
        Check(cancelled,"Cancellation was ignored");Check(File.ReadAllText(Path.Combine(target,"package.json")).Contains("1.8.1"),"Cancellation did not restore package version");
        Check(File.ReadAllText(Path.Combine(target,"server.mjs"))=="new","Cancellation damaged unchanged files");
        Console.WriteLine("Native update checks passed: hash, version, original folder, progress/settings, rollback, traversal.");return 0;
    }
}
