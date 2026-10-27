using System;
using System.IO;
using System.IO.Compression;
using System.Collections.Generic;
using System.Text;
using System.Web.Script.Serialization;
class NativeUpdateTest {
    static void Check(bool value,string message) {if(!value) throw new Exception(message);}
    static void Reject(Action action,string message) {bool rejected=false;try {action();} catch(IOException) {rejected=true;}Check(rejected,message);}
    static string Package(string fixture,string name,string version,string content,bool badPath) {
        string zip=Path.Combine(fixture,name+".zip");var files=new List<ReleaseFile>();
        using(var archive=ZipFile.Open(zip,ZipArchiveMode.Create)) {
            foreach(string relative in new[]{"Tarkov Offline.exe","EFT GPS.exe","server.mjs","public/index.html","package.json"}) {
                string value=relative=="package.json"?"{\"version\":\""+version+"\"}":content;
                string temp=Path.Combine(fixture,"hash-input");File.WriteAllText(temp,value,new UTF8Encoding(false));
                files.Add(new ReleaseFile{path=relative,size=new FileInfo(temp).Length,sha256=PackageInstaller.Hash(temp)});
                var entry=archive.CreateEntry(relative);using(var source=File.OpenRead(temp))using(var target=entry.Open())source.CopyTo(target);
            }
            if(badPath) using(var writer=new StreamWriter(archive.CreateEntry("../userdata/profile.json").Open()))writer.Write("bad");
            using(var writer=new StreamWriter(archive.CreateEntry("release.json").Open()))writer.Write(new JavaScriptSerializer().Serialize(new ReleaseInfo{format=1,app="TarkovOffline",version=version,files=files.ToArray()}));
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
        Console.WriteLine("Native update checks passed: hash, version, original folder, progress/settings, rollback, traversal.");return 0;
    }
}
