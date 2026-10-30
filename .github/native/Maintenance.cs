using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Net;
using System.Drawing;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;

public static class InstallerElevation {
    public static string UserSid=WindowsIdentity.GetCurrent().User.Value;
    public static string Programs=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs");
    public static string Desktop=Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
    static string parentPipe;
    public static bool IsAdministrator {get{return new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator);}}
    public static string Quote(string value) {
        var result=new StringBuilder("\"");int slashes=0;
        foreach(char c in value) {if(c=='\\'){slashes++;continue;}result.Append('\\',c=='\"'?slashes*2+1:slashes);result.Append(c);slashes=0;}
        result.Append('\\',slashes*2);result.Append('"');return result.ToString();
    }
    public static bool RelaunchIfNeeded(ref string[] args) {
        if(IsAdministrator) {
            if(args.Length>=5 && args[0]=="--installer-elevated") {
                UserSid=new SecurityIdentifier(args[1]).Value;Programs=Path.GetFullPath(args[2]);Desktop=Path.GetFullPath(args[3]);parentPipe=args[4];
                Guid id;if(!parentPipe.StartsWith("EFTGPS-install-") || !Guid.TryParseExact(parentPipe.Substring(15),"N",out id))throw new IOException("Некорректный сеанс установки");
                var remaining=new string[args.Length-5];Array.Copy(args,5,remaining,0,remaining.Length);args=remaining;
            }
            return false;
        }
        string name="EFTGPS-install-"+Guid.NewGuid().ToString("N");
        var security=new PipeSecurity();security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(UserSid),PipeAccessRights.FullControl,AccessControlType.Allow));security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null),PipeAccessRights.ReadWrite,AccessControlType.Allow));
        using(var server=new NamedPipeServerStream(name,PipeDirection.In,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,4096,4096,security)) {
            var request=Task.Run((Func<string>)delegate {server.WaitForConnection();using(var reader=new StreamReader(server,Encoding.UTF8))return reader.ReadLine();});
            request.ContinueWith(t=>{var ignored=t.Exception;},TaskContinuationOptions.OnlyOnFaulted);
            var forwarded=new List<string>{"--installer-elevated",UserSid,Programs,Desktop,name};forwarded.AddRange(args);var command=new StringBuilder();foreach(var value in forwarded){if(command.Length>0)command.Append(' ');command.Append(Quote(value));}
            try {
                using(var child=Process.Start(new ProcessStartInfo(Application.ExecutablePath,command.ToString()){UseShellExecute=true,Verb="runas",WorkingDirectory=AppDomain.CurrentDomain.BaseDirectory})) {
                    if(child==null)throw new IOException("Не удалось запустить установщик");child.WaitForExit();Environment.ExitCode=child.ExitCode;
                }
                if(!request.IsCompleted)try{request.Wait(1000);}catch(AggregateException){}
                if(request.Status==TaskStatus.RanToCompletion && !String.IsNullOrEmpty(request.Result)) {
                    string application=Path.GetFullPath(request.Result);
                    if(Path.GetFileName(application)=="EFT GPS.exe" && File.Exists(application))Process.Start(new ProcessStartInfo(application){UseShellExecute=false,WorkingDirectory=Path.GetDirectoryName(application)});
                }
            } catch(System.ComponentModel.Win32Exception e) {if(e.NativeErrorCode!=1223)throw;Environment.ExitCode=1223;}
        }
        return true;
    }
    public static void PrepareUserData(string target) {
        string data=Path.GetFullPath(Path.Combine(target,"userdata"));
        for(string current=data;current!=null;current=Path.GetDirectoryName(current))
            if((Directory.Exists(current)||File.Exists(current)) && (File.GetAttributes(current)&FileAttributes.ReparsePoint)!=0)throw new IOException("Папка пользовательских данных содержит перенаправление");
        Directory.CreateDirectory(data);
        var acl=Directory.GetAccessControl(data);acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(UserSid),FileSystemRights.Modify,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));Directory.SetAccessControl(data,acl);
    }
    public static void OpenApplication(string target) {
        string application=Path.Combine(target,"EFT GPS.exe");
        if(parentPipe!=null) {
            using(var pipe=new NamedPipeClientStream(".",parentPipe,PipeDirection.Out)) {pipe.Connect(3000);using(var writer=new StreamWriter(pipe,new UTF8Encoding(false))){writer.WriteLine(application);writer.Flush();}}
        } else if(IsAdministrator) Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"explorer.exe"),Quote(application)){UseShellExecute=true});
        else Process.Start(new ProcessStartInfo(application){UseShellExecute=false,WorkingDirectory=target});
    }
}

public class ReleaseFile { public string path; public string sha256; public long size; }
public class ReleaseInfo { public int format; public string app; public string version, baseVersion; public ReleaseFile[] files; public string[] removed; }
public class InstallStatus { public string phase,file; public long done,total; public int percent; }
public sealed class InstallWorkspace : IDisposable {
    public readonly string Target,Stage;
    readonly bool createdTarget;
    public InstallWorkspace(string target,string stage,bool created) {Target=target;Stage=stage;createdTarget=created;}
    public void Dispose() {
        string full=Path.GetFullPath(Stage);
        if(Path.GetDirectoryName(full).Equals(Target,StringComparison.OrdinalIgnoreCase) && Path.GetFileName(full).StartsWith(".EFTGPS-stage-") && Directory.Exists(full)) Directory.Delete(full,true);
        if(createdTarget && !File.Exists(Path.Combine(Target,"Tarkov Offline.exe"))) RemoveEmpty(Target);
    }
    static void RemoveEmpty(string folder) {
        if(!Directory.Exists(folder) || (File.GetAttributes(folder)&FileAttributes.ReparsePoint)!=0)return;
        foreach(var child in Directory.GetDirectories(folder)) RemoveEmpty(child);
        try {Directory.Delete(folder,false);}catch(IOException){}catch(UnauthorizedAccessException){}
    }
}
public static class PackageInstaller {
    public static string RecommendedFolder {get{return Path.Combine(InstallerElevation.Programs,"EFT GPS");}}
    [ThreadStatic] static HashSet<string> safeDirectories;
    static void ResetPaths() { safeDirectories=new HashSet<string>(StringComparer.OrdinalIgnoreCase); }
    static string Normalized(string folder) {string full=Path.GetFullPath(folder);return full.Length>Path.GetPathRoot(full).Length?full.TrimEnd(Path.DirectorySeparatorChar):full;}
    static bool EmptyTree(string folder) {
        foreach(string entry in Directory.EnumerateFileSystemEntries(folder)) if(!Directory.Exists(entry) || (File.GetAttributes(entry)&FileAttributes.ReparsePoint)!=0 || !EmptyTree(entry))return false;
        return true;
    }
    public static bool TargetAllowed(string target,string ownedStage=null) {
        target=Normalized(target);
        if(!Directory.Exists(target) || File.Exists(Path.Combine(target,"Tarkov Offline.exe")))return true;
        foreach(string entry in Directory.EnumerateFileSystemEntries(target)) {
            if(ownedStage!=null && Path.GetFullPath(entry).Equals(Path.GetFullPath(ownedStage),StringComparison.OrdinalIgnoreCase) && Path.GetDirectoryName(Path.GetFullPath(ownedStage)).Equals(target,StringComparison.OrdinalIgnoreCase) && Path.GetFileName(ownedStage).StartsWith(".EFTGPS-stage-")) continue;
            if(!Directory.Exists(entry) || (File.GetAttributes(entry)&FileAttributes.ReparsePoint)!=0 || !EmptyTree(entry)) return false;
        }
        return true;
    }
    public static InstallWorkspace PrepareWorkspace(string target) {
        target=Normalized(target);bool created=!Directory.Exists(target);string stage=Path.Combine(target,".EFTGPS-stage-"+Guid.NewGuid().ToString("N"));
        if(!TargetAllowed(target))throw new IOException("Выберите пустую папку или папку установленного EFT GPS");
        ResetPaths();string probe=SafePath(target,"EFTGPS-access-"+Guid.NewGuid().ToString("N")+".tmp");
        try {
            Directory.CreateDirectory(target);
            using(var file=new FileStream(probe,FileMode.CreateNew,FileAccess.Write,FileShare.None,4096,FileOptions.DeleteOnClose)) file.WriteByte(1);
            Directory.CreateDirectory(stage);
            return new InstallWorkspace(target,stage,created);
        } catch(UnauthorizedAccessException e) {
            if(created)try{Directory.Delete(target,false);}catch{}
            throw new IOException("Нет прав записи в выбранную папку. Выберите другую папку через «Обзор», например папку в вашем профиле пользователя. Путь: "+target,e);
        }
    }
    static void Notify(Action<InstallStatus> progress,string phase,string file,long done,long total,int start,int span) {
        if(progress!=null) progress(new InstallStatus {phase=phase,file=file,done=done,total=total,percent=start+(int)(total==0?0:Math.Min(span,done*(double)span/total))});
    }
    static void CheckBase(string target,ReleaseInfo release) {
        if(release.format!=2) return;
        var installed=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(target,"package.json")));
        if((string)installed["version"]!=release.baseVersion) throw new IOException("Пакет изменений предназначен для другой версии. Используйте полный установщик.");
    }
    public static void CheckUpdateHash(string zip, string expected, CancellationToken cancellation=default(CancellationToken)) {
        if(expected == null || expected.Length != 64 || Hash(zip,cancellation) != expected) throw new IOException("Контрольная сумма обновления не совпадает");
    }
    public static void CheckUpdateVersion(string target, ReleaseInfo release, string expected) {
        CheckBase(target,release);
        var installed=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(target,"package.json")));
        if(release.version!=expected || new Version(release.version)<=new Version((string)installed["version"])) throw new IOException("Версия обновления не подходит");
    }
    static string Extended(string value) {
        if (value.StartsWith(@"\\?\")) return value;
        return value.StartsWith(@"\\") ? @"\\?\UNC\" + value.Substring(2) : @"\\?\" + value;
    }
    public static string Hash(string file,CancellationToken cancellation=default(CancellationToken)) { using(var sha=SHA256.Create())using(var stream=File.OpenRead(file)){var buffer=new byte[128*1024];int count;while((count=stream.Read(buffer,0,buffer.Length))>0){cancellation.ThrowIfCancellationRequested();sha.TransformBlock(buffer,0,count,buffer,0);}sha.TransformFinalBlock(new byte[0],0,0);return BitConverter.ToString(sha.Hash).Replace("-", "").ToLowerInvariant();} }
    static string SafePath(string root, string relative) {
        if (String.IsNullOrWhiteSpace(relative) || relative.IndexOf('\\') >= 0 || relative.IndexOf(':') >= 0 || relative.StartsWith("/")) throw new IOException("Некорректный путь в пакете");
        foreach (string segment in relative.Split('/')) if (segment == "." || segment == ".." || segment.Length == 0 || segment.EndsWith(".") || segment.EndsWith(" ") || segment.IndexOfAny(Path.GetInvalidFileNameChars())>=0 || System.Text.RegularExpressions.Regex.IsMatch(segment,@"^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(\.|$)",System.Text.RegularExpressions.RegexOptions.IgnoreCase)) throw new IOException("Некорректный путь в пакете");
        string first = relative.Split('/')[0].ToLowerInvariant();
        if (first == "userdata" || first == "work" || first.StartsWith("snapshot-backup") || first.StartsWith(".eftgps-") || first == "update-staging" || first == "release.json" || first == "release.json.install-new") throw new IOException("Пакет пытается изменить пользовательские файлы");
        string full = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
        string prefix = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new IOException("Путь выходит за папку приложения");
        string current = Path.GetDirectoryName(full);
        while (current != null) {
            if(safeDirectories!=null && safeDirectories.Contains(current)) break;
            if (Directory.Exists(Extended(current)) && (File.GetAttributes(Extended(current)) & FileAttributes.ReparsePoint) != 0) throw new IOException("Папка установки содержит перенаправление");
            if(safeDirectories!=null) safeDirectories.Add(current);
            current = Path.GetDirectoryName(current);
        }
        if (File.Exists(Extended(full)) && (File.GetAttributes(Extended(full)) & FileAttributes.ReparsePoint) != 0) throw new IOException("Файл установки является ссылкой");
        return Extended(full);
    }
    public static ReleaseInfo Stage(string zip, string staged, Action<string> progress, Action<InstallStatus> detail=null,CancellationToken cancellation=default(CancellationToken)) {
        using(var input=File.OpenRead(zip)) return Stage(input,staged,progress,detail,cancellation);
    }
    public static ReleaseInfo Stage(Stream input, string staged, Action<string> progress, Action<InstallStatus> detail=null,CancellationToken cancellation=default(CancellationToken)) {
        cancellation.ThrowIfCancellationRequested();
        ResetPaths();
        Directory.CreateDirectory(staged);
        SafePath(staged,"EFTGPS-stage-probe");
        using (var archive = new ZipArchive(input,ZipArchiveMode.Read,true)) {
            var entry = archive.GetEntry("release.json");
            if (entry == null || entry.Length > 16 * 1024 * 1024) throw new IOException("Это не пакет EFT GPS");
            ReleaseInfo release;
            using (var reader = new StreamReader(entry.Open())) release = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 }.Deserialize<ReleaseInfo>(reader.ReadToEnd());
            if (release == null || (release.format != 1 && release.format != 2) || release.app != "TarkovOffline" || release.files == null || release.files.Length == 0) throw new IOException("Неподдерживаемый пакет");
            Version version;
            if (!Version.TryParse(release.version, out version)) throw new IOException("В пакете нет версии");
            Version baseVersion;
            if(release.format==2 && (!Version.TryParse(release.baseVersion,out baseVersion) || baseVersion>=version)) throw new IOException("Некорректная базовая версия пакета изменений");
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var indexed = new Dictionary<string, ZipArchiveEntry>(StringComparer.OrdinalIgnoreCase);
            long total = 0;
            foreach (var item in archive.Entries) {
                cancellation.ThrowIfCancellationRequested();
                if (!indexed.TryAddCompat(item.FullName, item)) throw new IOException("Повторяющийся путь в пакете");
                if (item.FullName != "release.json") {if(item.FullName.EndsWith(".install-new",StringComparison.OrdinalIgnoreCase))throw new IOException("Пакет содержит служебный временный файл");SafePath(staged, item.FullName);}
                if (((item.ExternalAttributes >> 16) & 0xF000) == 0xA000) throw new IOException("Ссылки в пакете запрещены");
            }
            if (indexed.Count != release.files.Length + 1) throw new IOException("Состав пакета не совпадает с описанием");
            int count = 0; long written=0,expectedBytes=0;
            foreach(var file in release.files) {if(file.size<0 || file.size>8L*1024*1024*1024-expectedBytes) throw new IOException("Пакет слишком большой");expectedBytes+=file.size;}
            var drive=new DriveInfo(Path.GetPathRoot(Path.GetFullPath(staged)));if(drive.IsReady&&drive.AvailableFreeSpace<expectedBytes+128L*1024*1024)throw new IOException("Недостаточно места для распаковки");
            var directories=new HashSet<string>(StringComparer.OrdinalIgnoreCase);var buffer=new byte[128*1024];var clock=Stopwatch.StartNew();
            foreach (var file in release.files) {
                cancellation.ThrowIfCancellationRequested();
                if (!names.Add(file.path) || file.sha256 == null || file.sha256.Length != 64 || file.size < 0) throw new IOException("Повреждён список файлов");
                string destination = SafePath(staged, file.path);
                ZipArchiveEntry item;
                if (!indexed.TryGetValue(file.path, out item) || item.Length != file.size) throw new IOException("В пакете отсутствует файл: " + file.path);
                total += item.Length;
                if (total > 8L * 1024 * 1024 * 1024) throw new IOException("Пакет слишком большой");
                string directory=Path.GetDirectoryName(destination);if(directories.Add(directory)) Directory.CreateDirectory(directory);
                using(var sha=SHA256.Create()) using(var source=item.Open()) using(var target=new FileStream(destination,FileMode.Create,FileAccess.Write,FileShare.None,128*1024,FileOptions.SequentialScan)) {
                    int size;long length=0;
                    while((size=source.Read(buffer,0,buffer.Length))>0) {cancellation.ThrowIfCancellationRequested();length+=size;if(length>file.size) throw new IOException("Повреждён размер файла");target.Write(buffer,0,size);sha.TransformBlock(buffer,0,size,buffer,0);written+=size;
                        if(clock.ElapsedMilliseconds>=100) {Notify(detail,"Распаковка и проверка",file.path,written,expectedBytes,10,65);clock.Restart();}}
                    sha.TransformFinalBlock(new byte[0],0,0);
                    if(length!=file.size || BitConverter.ToString(sha.Hash).Replace("-", "").ToLowerInvariant()!=file.sha256) throw new IOException("Не прошла проверка файла: " + file.path);
                }
                if (++count % 1000 == 0) progress("Проверено файлов: " + count + " / " + release.files.Length);
            }
            if(release.format==1 && (!names.Contains("Tarkov Offline.exe") || !names.Contains("server.mjs") || !names.Contains("public/index.html"))) throw new IOException("В пакете нет основных файлов приложения");
            if(release.format==2 && !names.Contains("package.json")) throw new IOException("В пакете изменений нет версии приложения");
            if(names.Contains("package.json")) {var metadata=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(SafePath(staged,"package.json")));if((string)metadata["version"]!=release.version)throw new IOException("Версия файлов не совпадает с описанием пакета");}
            foreach(var removed in release.removed??new string[0]) {SafePath(staged,removed);if(removed.EndsWith(".install-new",StringComparison.OrdinalIgnoreCase) || !names.Add(removed) || removed=="package.json" || removed=="EFT GPS.exe" || removed=="server.mjs" || removed=="public/index.html") throw new IOException("Некорректное удаление в пакете изменений");}
            Notify(detail,"Распаковка и проверка","",expectedBytes,expectedBytes,10,65);
            File.WriteAllText(Path.Combine(staged, "release.json"), new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 }.Serialize(release), Encoding.UTF8);
            return release;
        }
    }
    static bool TryAddCompat<T>(this Dictionary<string,T> map, string key, T value) { if (map.ContainsKey(key)) return false; map.Add(key, value); return true; }
    public static string Install(string target, string staged, ReleaseInfo release, Action<string> progress, Action<InstallStatus> detail=null,CancellationToken cancellation=default(CancellationToken),Action beforeCommit=null) {
        cancellation.ThrowIfCancellationRequested();
        ResetPaths(); CheckBase(target,release);
        target = Path.GetFullPath(target);
        if (!TargetAllowed(target,staged)) throw new IOException("Выберите пустую папку или папку установленного EFT GPS");
        Directory.CreateDirectory(target);
        string backup = Path.Combine(target, "work", "install-backup-" + DateTime.Now.ToString("yyyyMMdd-HHmmss-fff"));
        string work = Path.Combine(target, "work");
        if (Directory.Exists(work) && (File.GetAttributes(work) & FileAttributes.ReparsePoint) != 0) throw new IOException("Служебная папка является перенаправлением");
        var changed = new List<string>();
        var existed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var previous=Path.Combine(target,"release.json");
        if(File.Exists(previous) && (File.GetAttributes(previous)&FileAttributes.ReparsePoint)!=0)throw new IOException("Описание установленной версии является ссылкой");
        string previousManifest=File.Exists(previous)?File.ReadAllText(previous):null;
        var merged=new Dictionary<string,ReleaseFile>(StringComparer.OrdinalIgnoreCase);
        if(release.format==2) {
            if(previousManifest==null) throw new IOException("Нет описания установленной версии. Используйте полный установщик.");
            var prior=new JavaScriptSerializer {MaxJsonLength=16*1024*1024}.Deserialize<ReleaseInfo>(previousManifest);
            if(prior.version!=release.baseVersion || prior.format!=1) throw new IOException("Не совпадает базовая версия установленной базы");
            foreach(var file in prior.files) merged.Add(file.path,file);
        }
        int processed=0,totalFiles=release.files.Length+(release.removed==null?0:release.removed.Length);var clock=Stopwatch.StartNew();
        try {
            foreach(var relative in release.removed??new string[0]) {
                cancellation.ThrowIfCancellationRequested();
                string destination=SafePath(target,relative);
                if(File.Exists(destination)) {string copy=SafePath(backup,relative);Directory.CreateDirectory(Path.GetDirectoryName(copy));File.Copy(destination,copy);existed.Add(relative);changed.Add(relative);File.Delete(destination);}
                merged.Remove(relative);Notify(detail,"Замена файлов",relative,++processed,totalFiles,75,24);
            }
            foreach (var file in release.files) {
                cancellation.ThrowIfCancellationRequested();
                string destination = SafePath(target, file.path);
                merged[file.path]=file;processed++;
                if(totalFiles<=100 || clock.ElapsedMilliseconds>=100) {Notify(detail,"Замена файлов",file.path,processed,totalFiles,75,24);clock.Restart();}
                if (File.Exists(destination) && new FileInfo(destination).Length==file.size && Hash(destination,cancellation) == file.sha256) continue;
                if (File.Exists(destination)) {
                    string copy = SafePath(backup, file.path);
                    Directory.CreateDirectory(Path.GetDirectoryName(copy));
                    File.Copy(destination, copy);
                    existed.Add(file.path);
                }
                Directory.CreateDirectory(Path.GetDirectoryName(destination));
                changed.Add(file.path);
                string next = SafePath(target, file.path + ".install-new");
                string source=SafePath(staged,file.path);
                if(String.Equals(Path.GetPathRoot(target),Path.GetPathRoot(staged),StringComparison.OrdinalIgnoreCase)) File.Move(source,next);else File.Copy(source,next,false);
                if (File.Exists(destination)) File.Replace(next, destination, null); else File.Move(next, destination);
                if (changed.Count % 100 == 0) progress("Установка: " + changed.Count + " файлов");
            }
            cancellation.ThrowIfCancellationRequested();
            if(beforeCommit!=null)beforeCommit();
            var installed=new ReleaseInfo {format=1,app=release.app,version=release.version,files=new List<ReleaseFile>(merged.Values).ToArray()};
            string nextManifest=Path.Combine(target,"release.json.install-new");
            using(var output=new FileStream(nextManifest,FileMode.CreateNew,FileAccess.Write,FileShare.None))using(var writer=new StreamWriter(output,Encoding.UTF8))writer.Write(new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 }.Serialize(installed));
            if(File.Exists(previous)) File.Replace(nextManifest,previous,null);else File.Move(nextManifest,previous);
            Notify(detail,"Завершение","",totalFiles,totalFiles,75,24);
            return backup;
        } catch {
            var failures = new List<string>();
            changed.Reverse();
            foreach (string relative in changed) {
                try {
                    string destination = SafePath(target, relative);
                    string stagedFile=SafePath(staged,relative);
                    if(!File.Exists(stagedFile) && release.files!=null && Array.Exists(release.files,f=>f.path==relative)) {
                        Directory.CreateDirectory(Path.GetDirectoryName(stagedFile));
                        if(File.Exists(destination+".install-new")) File.Move(destination+".install-new",stagedFile);
                        else if(File.Exists(destination)) File.Move(destination,stagedFile);
                    }
                    if (existed.Contains(relative)) File.Copy(SafePath(backup, relative), destination, true);
                    else if (File.Exists(destination)) File.Delete(destination);
                    if (File.Exists(destination + ".install-new")) File.Delete(destination + ".install-new");
                } catch { failures.Add(relative); }
            }
            if (failures.Count > 0) throw new IOException("Не удалось полностью восстановить файлы. Резервная копия: " + backup);
            throw;
        }
    }
}

// A seekable view of the ZIP appended to setup: no 2.6 GB temporary copy.
class PackageView : Stream {
    readonly Stream input;readonly long start,length;
    public PackageView(Stream source,long offset,long size){input=source;start=offset;length=size;Position=0;}
    public override bool CanRead {get{return true;}}public override bool CanSeek {get{return true;}}public override bool CanWrite {get{return false;}}
    public override long Length {get{return length;}}public override long Position {get{return input.Position-start;}set{if(value<0||value>length)throw new IOException("Invalid package offset");input.Position=start+value;}}
    public override int Read(byte[] buffer,int offset,int count){return input.Read(buffer,offset,(int)Math.Min(count,length-Position));}
    public override long Seek(long offset,SeekOrigin origin){Position=(origin==SeekOrigin.Begin?0:origin==SeekOrigin.Current?Position:length)+offset;return Position;}
    public override void Flush(){}public override void SetLength(long value){throw new NotSupportedException();}public override void Write(byte[] buffer,int offset,int count){throw new NotSupportedException();}
    protected override void Dispose(bool disposing){if(disposing)input.Dispose();base.Dispose(disposing);}
}

class DarkWindow : Form {
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);
    public DarkWindow() {
        BackColor = Color.Black; ForeColor = Color.FromArgb(232,232,226);
        Font = new Font("Segoe UI", 10); AutoScaleDimensions=new SizeF(96,96); AutoScaleMode = AutoScaleMode.Dpi;
        StartPosition = FormStartPosition.CenterScreen;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        MaximizeBox = false; FormBorderStyle = FormBorderStyle.FixedSingle;
    }
    protected override void OnShown(EventArgs e) {base.OnShown(e);NativeText.Apply(this);}
    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        try { int dark=1, black=0, white=0x00E2E8E8;
            DwmSetWindowAttribute(Handle,20,ref dark,4); DwmSetWindowAttribute(Handle,35,ref black,4);
            DwmSetWindowAttribute(Handle,36,ref white,4); DwmSetWindowAttribute(Handle,34,ref black,4);
        } catch {}
    }
    public static Button ButtonAt(string text, int x, int y, int width, bool primary) {
        var button = new Button { Text=text, Bounds=new Rectangle(x,y,width,40), FlatStyle=FlatStyle.Flat,
            BackColor=primary ? Color.FromArgb(185,171,130) : Color.FromArgb(17,17,17),
            ForeColor=primary ? Color.Black : Color.Gainsboro, Cursor=Cursors.Hand };
        button.FlatAppearance.BorderColor=Color.FromArgb(67,66,59); button.FlatAppearance.BorderSize=1;
        button.FlatAppearance.MouseOverBackColor=primary ? Color.FromArgb(212,198,156) : Color.FromArgb(33,33,30);
        return button;
    }
    public Label TextAt(string text, int x, int y, int width, int height, float size, Color color) {
        var label=new Label { Text=text, Bounds=new Rectangle(x,y,width,height), Font=new Font("Segoe UI",size), ForeColor=color };
        Controls.Add(label); return label;
    }
}
class FolderChoice {
    public string Path, Name;
    public FolderChoice(string path,string name) {Path=path;Name=name;}
}
// Owner-drawn folder list: keyboard navigation and a dark scrollbar, without shell chrome.
class FolderList : Control {
    public List<FolderChoice> Items=new List<FolderChoice>();
    public Action SelectionChanged, OpenSelected;
    public int Selected=-1;
    int first; bool dragging; int dragY, dragFirst;
    const int row=38;
    int VisibleRows {get {return Math.Max(1,Height/row);}}
    int MaxFirst {get {return Math.Max(0,Items.Count-VisibleRows);}}
    Rectangle Thumb {get {int h=Math.Min(Height,Math.Max(30,Height*VisibleRows/Math.Max(VisibleRows,Items.Count)));return new Rectangle(Width-8,first*(Height-h)/Math.Max(1,MaxFirst),3,h);}}
    public FolderList() {DoubleBuffered=true;TabStop=true;AccessibleName="Папки";AccessibleRole=AccessibleRole.List;BackColor=Color.FromArgb(13,13,12);}
    public void SetItems(List<FolderChoice> items) {Items=items;Selected=-1;first=0;Invalidate();}
    void Scroll(int value) {first=Math.Max(0,Math.Min(MaxFirst,value));Invalidate();}
    void SelectRow(int value) {if(Items.Count==0) return;Selected=Math.Max(0,Math.Min(Items.Count-1,value));if(Selected<first) first=Selected;if(Selected>=first+VisibleRows) first=Selected-VisibleRows+1;Invalidate();if(SelectionChanged!=null) SelectionChanged();}
    protected override bool IsInputKey(Keys key) {return key==Keys.Up||key==Keys.Down||key==Keys.Home||key==Keys.End||key==Keys.PageUp||key==Keys.PageDown||base.IsInputKey(key);}
    protected override void OnKeyDown(KeyEventArgs e) {
        base.OnKeyDown(e);
        if(e.KeyCode==Keys.Down) SelectRow(Selected+1); else if(e.KeyCode==Keys.Up) SelectRow(Selected-1);
        else if(e.KeyCode==Keys.Home) SelectRow(0); else if(e.KeyCode==Keys.End) SelectRow(Items.Count-1);
        else if(e.KeyCode==Keys.PageDown) SelectRow(Selected+VisibleRows);else if(e.KeyCode==Keys.PageUp) SelectRow(Selected-VisibleRows);
        else if(e.KeyCode==Keys.Enter && Selected>=0 && OpenSelected!=null) {OpenSelected();e.Handled=true;}
    }
    protected override void OnMouseWheel(MouseEventArgs e) {base.OnMouseWheel(e);Scroll(first-e.Delta/120*3);}
    protected override void OnMouseDown(MouseEventArgs e) {
        base.OnMouseDown(e);Focus();
        if(e.X>=Width-16 && MaxFirst>0) {if(e.Y>=Thumb.Top && e.Y<=Thumb.Bottom) {dragging=true;dragY=e.Y;dragFirst=first;Capture=true;} else Scroll(first+(e.Y<Thumb.Top ? -VisibleRows : VisibleRows));return;}
        int index=first+e.Y/row;if(index<Items.Count) SelectRow(index);
    }
    protected override void OnMouseMove(MouseEventArgs e) {base.OnMouseMove(e);if(dragging) Scroll(dragFirst+(e.Y-dragY)*MaxFirst/Math.Max(1,Height-Thumb.Height));}
    protected override void OnMouseUp(MouseEventArgs e) {base.OnMouseUp(e);dragging=false;Capture=false;Invalidate();}
    protected override void OnMouseDoubleClick(MouseEventArgs e) {base.OnMouseDoubleClick(e);if(e.X<Width-16 && Selected>=0 && OpenSelected!=null) OpenSelected();}
    protected override void OnPaint(PaintEventArgs e) {
        e.Graphics.Clear(BackColor);
        for(int index=first;index<Math.Min(Items.Count,first+VisibleRows+1);index++) {
            int y=(index-first)*row;
            if(index==Selected) using(var brush=new SolidBrush(Color.FromArgb(47,45,36))) e.Graphics.FillRectangle(brush,0,y,Width-16,row);
            using(var brush=new SolidBrush(Color.FromArgb(185,171,130))) {e.Graphics.FillRectangle(brush,14,y+14,18,13);e.Graphics.FillRectangle(brush,14,y+11,8,4);}
            TextRenderer.DrawText(e.Graphics,Items[index].Name,Font,new Rectangle(46,y,Width-68,row),ForeColor,TextFormatFlags.Left|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);
        }
        if(MaxFirst>0) using(var brush=new SolidBrush(dragging ? Color.FromArgb(180,185,171,130) : Color.FromArgb(85,185,171,130))) e.Graphics.FillRectangle(brush,Thumb);
        if(Focused) ControlPaint.DrawFocusRectangle(e.Graphics,ClientRectangle,Color.FromArgb(85,85,78),BackColor);
    }
}
class DarkFolderPicker : DarkWindow {
    readonly TextBox address=new TextBox();
    readonly FolderList folders=new FolderList();
    readonly Label hint=new Label();
    readonly Stack<string> history=new Stack<string>();
    Button back,up,choose;
    string current="",selected;
    int request;
    public string SelectedPath {get;private set;}
    public DarkFolderPicker(string initial) {
        Text="EFT GPS · Выбор папки";ClientSize=new Size(840,590);MinimizeBox=false;StartPosition=FormStartPosition.CenterParent;
        TextAt("Куда установить приложение?",24,20,792,39,20,ForeColor);
        TextAt("Выберите папку или введите новый путь — создадим её во время установки.",24,67,792,28,10,Color.Silver);
        back=ButtonAt("←",24,108,44,false);back.AccessibleName="Назад";back.Click+=delegate {if(history.Count>0) Navigate(history.Pop(),false);};
        up=ButtonAt("↑",76,108,44,false);up.AccessibleName="На уровень выше";up.Click+=delegate {GoUp();};
        address.SetBounds(134,115,570,29);address.BackColor=Color.FromArgb(19,19,18);address.ForeColor=ForeColor;address.BorderStyle=BorderStyle.FixedSingle;address.AccessibleName="Путь к папке";
        address.KeyDown+=delegate(object sender,KeyEventArgs e) {if(e.KeyCode==Keys.Enter) {e.SuppressKeyPress=true;Navigate(address.Text,true);}};
        var go=ButtonAt("Перейти",716,108,100,false);go.Click+=delegate {Navigate(address.Text,true);};
        string[] names={"Этот компьютер","Рабочий стол","Документы","Моя папка","Программы","Program Files"};
        string[] paths={"",Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),Path.GetDirectoryName(PackageInstaller.RecommendedFolder),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles)};
        for(int n=0;n<names.Length;n++) {string location=paths[n];var quick=ButtonAt(names[n],24,172+n*48,164,false);quick.Click+=delegate {Navigate(location,true);};Controls.Add(quick);}
        folders.SetBounds(208,172,608,302);folders.ForeColor=ForeColor;
        folders.SelectionChanged=delegate {if(folders.Selected>=0) {selected=folders.Items[folders.Selected].Path;choose.Enabled=true;hint.Text=NativeText.T("Выбрано: "+selected);}};
        folders.OpenSelected=delegate {if(folders.Selected>=0) Navigate(folders.Items[folders.Selected].Path,true);};
        hint.SetBounds(24,490,792,42);hint.ForeColor=Color.Silver;
        var cancel=ButtonAt("Отмена",488,536,132,false);cancel.DialogResult=DialogResult.Cancel;
        choose=ButtonAt("Выбрать папку",632,536,184,true);choose.Click+=delegate {
            try {string value=selected ?? address.Text;if(String.IsNullOrWhiteSpace(value)) throw new IOException("Выберите диск или папку.");SelectedPath=Normalize(value);DialogResult=DialogResult.OK;Close();}
            catch(Exception e) {hint.Text=NativeText.T(e.Message);}
        };
        address.TextChanged+=delegate {selected=null;};
        Controls.AddRange(new Control[]{back,up,address,go,folders,hint,cancel,choose});CancelButton=cancel;
        KeyPreview=true;KeyDown+=delegate(object sender,KeyEventArgs e) {if(e.Alt && e.KeyCode==Keys.Up) {GoUp();e.Handled=true;}else if(e.Alt && e.KeyCode==Keys.Left && history.Count>0) {Navigate(history.Pop(),false);e.Handled=true;}};
        Shown+=delegate {Navigate(initial,false);};
    }
    internal static string Normalize(string path) {
        string full=Path.GetFullPath(Environment.ExpandEnvironmentVariables(path.Trim()));
        foreach(string part in full.Substring(Path.GetPathRoot(full).Length).Split(Path.DirectorySeparatorChar)) {
            if(part.IndexOfAny(Path.GetInvalidFileNameChars())>=0 || part.EndsWith(" ") || part.EndsWith(".")) throw new IOException("В имени папки есть недопустимые символы.");
        }
        return full;
    }
    void GoUp() {if(current.Length==0) return;var parent=Directory.GetParent(current);Navigate(parent==null ? "" : parent.FullName,true);}
    async void Navigate(string path,bool remember) {
        int ticket=++request;
        try {
            string destination=path.Length==0 ? "" : Normalize(path);
            if(remember && current!=destination) history.Push(current);
            current=destination;selected=null;address.Text=destination;back.Enabled=history.Count>0;up.Enabled=destination.Length>0;
            choose.Enabled=false;folders.SetItems(new List<FolderChoice>());hint.Text=NativeText.T("Открываем папку…");
            var result=await Task.Run(()=> {
                var entries=new List<FolderChoice>();
                if(destination.Length==0) {foreach(var drive in DriveInfo.GetDrives()) entries.Add(new FolderChoice(drive.Name,"Диск "+drive.Name));}
                else if(Directory.Exists(destination)) {foreach(string directory in Directory.GetDirectories(destination)) entries.Add(new FolderChoice(directory,Path.GetFileName(directory)));entries.Sort((a,b)=>StringComparer.CurrentCultureIgnoreCase.Compare(a.Name,b.Name));}
                return entries;
            });
            if(IsDisposed || ticket!=request) return;
            folders.SetItems(result);choose.Enabled=destination.Length>0;
            hint.Text=NativeText.T(destination.Length==0 ? "Выберите диск для просмотра папок." : (!Directory.Exists(destination) ? "Новая папка будет создана при установке." : "Папок: "+result.Count+". Двойной щелчок — открыть; «Выбрать папку» — подтвердить."));
        } catch(Exception e) {if(!IsDisposed && ticket==request) {hint.Text=NativeText.T("Не удалось открыть папку: "+e.Message);choose.Enabled=false;}}
    }
}
class InstallConfirmation : DarkWindow {
    public InstallConfirmation(string heading, string message, string accept) {
        Text="EFT GPS · Подтверждение"; ClientSize=new Size(620,360); MinimizeBox=false;
        TextAt(heading,24,22,572,42,19,ForeColor);
        TextAt(message,24,78,572,206,10,Color.Silver);
        var cancel=ButtonAt("Назад",300,296,128,false); cancel.DialogResult=DialogResult.Cancel;
        var confirm=ButtonAt(accept,440,296,156,true); confirm.DialogResult=DialogResult.OK;
        Controls.AddRange(new Control[]{cancel,confirm}); AcceptButton=confirm; CancelButton=cancel;
        StartPosition=FormStartPosition.CenterParent;
    }
}
// Native text editing and copying, with a scrollbar painted in the app palette.
class DarkLog : Panel {
    class LogText : TextBox {
        public Action Changed;
        protected override void WndProc(ref Message m) { base.WndProc(ref m); if(Changed!=null && (m.Msg==0x20A || m.Msg==0x115 || m.Msg==0x101 || m.Msg==0xB7)) Changed(); }
    }
    class ScrollRail : Control {
        public DarkLog Owner; bool dragging; int dragStart, lineStart;
        public ScrollRail() { DoubleBuffered=true; Cursor=Cursors.Hand; AccessibleRole=AccessibleRole.ScrollBar; AccessibleName="Прокрутка журнала"; }
        Rectangle Thumb() { int total=Owner.Total,visible=Owner.VisibleLines; int height=Math.Min(Height,Math.Max(24,Height*visible/Math.Max(visible,total))); int top=Owner.First*(Height-height)/Math.Max(1,total-visible);return new Rectangle(6,top,3,height); }
        protected override void OnPaint(PaintEventArgs e) { e.Graphics.Clear(Color.FromArgb(14,14,13)); if(Owner.Total<=Owner.VisibleLines) return; using(var brush=new SolidBrush(dragging ? Color.FromArgb(180,185,171,130) : Color.FromArgb(85,185,171,130))) e.Graphics.FillRectangle(brush,Thumb()); }
        protected override void OnMouseDown(MouseEventArgs e) { base.OnMouseDown(e); if(e.Y>=Thumb().Top && e.Y<=Thumb().Bottom) { dragging=true;dragStart=e.Y;lineStart=Owner.First;Capture=true; } else Owner.ScrollTo(Owner.First+(e.Y<Thumb().Top ? -Owner.VisibleLines : Owner.VisibleLines)); Invalidate(); }
        protected override void OnMouseMove(MouseEventArgs e) { base.OnMouseMove(e); if(dragging) Owner.ScrollTo(lineStart+(e.Y-dragStart)*Math.Max(1,Owner.Total-Owner.VisibleLines)/Math.Max(1,Height-Thumb().Height)); }
        protected override void OnMouseUp(MouseEventArgs e) { base.OnMouseUp(e); dragging=false;Capture=false;Invalidate(); }
        protected override void OnMouseWheel(MouseEventArgs e) { Owner.ScrollTo(Owner.First-e.Delta/120*3); }
    }
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr window,int message,IntPtr w,IntPtr l);
    readonly LogText content; readonly ScrollRail rail; string sourceText="";
    int First {get {return (int)SendMessage(content.Handle,0xCE,IntPtr.Zero,IntPtr.Zero);}}
    int Total {get {return (int)SendMessage(content.Handle,0xBA,IntPtr.Zero,IntPtr.Zero);}}
    int VisibleLines {get {return Math.Max(1,content.ClientSize.Height/content.Font.Height);}}
    void ScrollTo(int line) {line=Math.Max(0,Math.Min(line,Math.Max(0,Total-VisibleLines)));SendMessage(content.Handle,0xB6,IntPtr.Zero,(IntPtr)(line-First));rail.Invalidate();}
    public DarkLog() {
        BackColor=Color.FromArgb(14,14,13);
        rail=new ScrollRail {Dock=DockStyle.Right,Width=16,Owner=this};
        content=new LogText {Dock=DockStyle.Fill,Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.None,BorderStyle=BorderStyle.None,BackColor=BackColor,ForeColor=Color.Silver,AccessibleName="Журнал установки"};
        content.Changed=delegate {rail.Invalidate();}; content.TextChanged+=delegate {rail.Invalidate();};
        Controls.Add(content);Controls.Add(rail);
    }
    public override string Text { get {return content==null ? "" : content.Text;} set {sourceText=value;if(content!=null) content.Text=NativeText.T(value);} }
    public void RefreshLanguage() {if(content!=null) {content.Text=NativeText.T(sourceText);ScrollTo(Total);}}
    public void AppendText(string value) {sourceText+=value;content.AppendText(NativeText.T(value));content.SelectionStart=content.TextLength;content.ScrollToCaret();ScrollTo(Total);rail.Invalidate();}
    protected override void OnForeColorChanged(EventArgs e) {base.OnForeColorChanged(e);if(content!=null) content.ForeColor=ForeColor;}
    protected override void OnFontChanged(EventArgs e) {base.OnFontChanged(e);if(content!=null) content.Font=Font;}
}
class DarkCheckBox : CheckBox {
    public DarkCheckBox() {SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);Cursor=Cursors.Hand;}
    protected override void OnPaint(PaintEventArgs e) {
        e.Graphics.Clear(BackColor); int y=(Height-15)/2;
        using(var brush=new SolidBrush(Checked ? Color.FromArgb(185,171,130) : Color.FromArgb(22,22,20))) e.Graphics.FillRectangle(brush,0,y,15,15);
        using(var pen=new Pen(Color.FromArgb(99,98,88))) e.Graphics.DrawRectangle(pen,0,y,15,15);
        if(Checked) using(var pen=new Pen(Color.Black,2)) e.Graphics.DrawLines(pen,new Point[]{new Point(3,y+7),new Point(6,y+11),new Point(12,y+4)});
        TextRenderer.DrawText(e.Graphics,Text,Font,new Rectangle(24,0,Width-24,Height),Enabled ? ForeColor : Color.Gray,TextFormatFlags.Left|TextFormatFlags.VerticalCenter);
        if(Focused) ControlPaint.DrawFocusRectangle(e.Graphics,new Rectangle(22,2,Width-24,Height-4),ForeColor,BackColor);
    }
}
class InstallProgress : Control {
    public int Value; public bool Running;
    int offset; readonly System.Windows.Forms.Timer animation=new System.Windows.Forms.Timer { Interval=35 };
    public InstallProgress() { DoubleBuffered=true; animation.Tick+=delegate { offset=(offset+5)%Math.Max(1,Width+180); Invalidate(); }; animation.Start(); }
    protected override void OnPaint(PaintEventArgs e) {
        e.Graphics.Clear(Color.FromArgb(28,28,26));
        using(var brush=new SolidBrush(Color.FromArgb(185,171,130))) {
            if(Running) e.Graphics.FillRectangle(brush,offset-180,0,180,Height);
            else e.Graphics.FillRectangle(brush,0,0,Width*Value/100,Height);
        }
    }
    protected override void Dispose(bool disposing) { if(disposing) animation.Dispose(); base.Dispose(disposing); }
}
class Maintenance : DarkWindow {
    readonly Label status = new Label();
    readonly DarkLog log = new DarkLog();
    Button action, cancel, browse;
    readonly TextBox folder = new TextBox();
    readonly InstallProgress progress = new InstallProgress();
    readonly CheckBox shortcut = new DarkCheckBox();
    readonly Label components = new Label();
    readonly Label steps = new Label();
    readonly Label fileStatus=new Label(), timing=new Label(), percentage=new Label();
    readonly Stopwatch elapsed=new Stopwatch();
    readonly System.Windows.Forms.Timer displayClock=new System.Windows.Forms.Timer {Interval=500};
    Button details;
    LinkLabel recommended;
    bool expanded,prepared;
    CancellationTokenSource cancellation;
    string operation, target, package, expectedHash, expectedVersion;
    bool updating;
    bool busy, complete, writeShortcut;
    static readonly Color muted=Color.FromArgb(157,157,147);
    [STAThread] static void Main(string[] args) {
        AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
        AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
        if (args.Length == 3 && args[0] == "--test-install") {
            try {
                string stage = Path.Combine(args[2], "..", "installer-test-stage-" + Guid.NewGuid().ToString("N"));
                var release = PackageInstaller.Stage(args[1], stage, delegate {});
                PackageInstaller.Install(args[2], stage, release, delegate {});
                Environment.Exit(0);
            } catch (Exception e) { File.WriteAllText(args[2] + ".error.txt", e.ToString()); Environment.Exit(1); }
            return;
        }
        #if !INSTALLER_PREVIEW
        try {if(InstallerElevation.RelaunchIfNeeded(ref args))return;}catch(Exception e){MessageBox.Show(e.Message,"EFT GPS",MessageBoxButtons.OK,MessageBoxIcon.Error);return;}
        #endif
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        var window=new Maintenance(args);Application.Run(window);if(!window.complete)Environment.ExitCode=1223;
    }
    Maintenance(string[] args) {
        operation = args.Length > 0 ? args[0] : "--setup";
        target = args.Length > 1 ? Path.GetFullPath(args[1]) : PackageInstaller.RecommendedFolder;
        package = args.Length > 2 ? args[2] : null;
        updating = operation == "--update";
        expectedHash = args.Length > 3 ? args[3] : null;
        expectedVersion = args.Length > 4 ? args[4] : null;
        if (updating && (package == null || expectedHash == null || expectedVersion == null || !File.Exists(Path.Combine(target,"EFT GPS.exe")))) throw new IOException("Некорректные параметры обновления");
        NativeText.English=System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName!="ru";
        bool data=operation=="--data";
        prepared=data||updating;
        Text = data ? "EFT GPS · Обновление базы" : updating ? "EFT GPS · Обновление приложения" : "EFT GPS · Установка";
        ClientSize = new Size(820,720);
        Image branding=Icon.ToBitmap();
        using(var resource=System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream("installer-logo.png")) if(resource!=null) using(var image=Image.FromStream(resource)) branding=new Bitmap(image);
        var logo=new PictureBox { Bounds=new Rectangle(28,24,62,62), Image=branding, SizeMode=PictureBoxSizeMode.Zoom };
        Controls.Add(logo);
        TextAt("T_S_U_Y_U EFT GPS",106,22,520,40,22,ForeColor);
        TextAt(data ? "ОБНОВЛЕНИЕ СПРАВОЧНИКА" : updating ? "ОБНОВЛЕНИЕ ПРИЛОЖЕНИЯ" : "УСТАНОВКА ПРИЛОЖЕНИЯ  /  1.8.1",108,67,500,24,9,muted);
        steps.SetBounds(28,108,764,32); steps.Text="01  Подготовка     /     02  Установка     /     03  Готово"; steps.ForeColor=Color.FromArgb(185,171,130);
        Controls.Add(steps);
        TextAt(data ? "Свежая база — привычный прогресс" : updating ? "Новая версия — ваш прогресс на месте" : "Тарков под рукой. Даже без интернета.",28,154,764,38,18,ForeColor);
        TextAt(updating ? "Установим новую версию в ту же папку.\nВаши настройки, метки и прогресс сохранятся." : data ? "Обновим карты и справочник.\nВаши настройки и прогресс сохранятся." : "Выберите папку и установите приложение.\nКарты и справочник будут доступны без интернета.",28,201,764,55,10,muted);
        TextAt("ПАПКА ПРИЛОЖЕНИЯ",28,274,764,23,9,muted);
        folder.SetBounds(28,305,620,30); folder.Text=target; folder.BackColor=Color.FromArgb(19,19,18); folder.ForeColor=ForeColor; folder.BorderStyle=BorderStyle.FixedSingle;
        TextAt(updating||data?"Обновление будет установлено в эту папку.":"При выборе места создадим папку EFT GPS.",28,337,550,22,9,muted);
        recommended=new LinkLabel {Text="Рекомендуемая папка",Bounds=new Rectangle(592,337,200,24),LinkColor=Color.FromArgb(185,171,130),ActiveLinkColor=ForeColor,VisitedLinkColor=Color.FromArgb(185,171,130),TextAlign=ContentAlignment.TopRight,Visible=operation=="--setup",Font=new Font("Segoe UI",9)};
        recommended.LinkClicked+=delegate {folder.Text=PackageInstaller.RecommendedFolder;status.Text=NativeText.T("Выбрана рекомендуемая папка.");status.Visible=true;progress.Visible=percentage.Visible=timing.Visible=fileStatus.Visible=log.Visible=details.Visible=false;expanded=false;LayoutOperation(false);};Controls.Add(recommended);
        browse=ButtonAt("Обзор…",660,299,132,false);
        browse.Click+=delegate { using(var picker=new DarkFolderPicker(folder.Text)) if(picker.ShowDialog(this)==DialogResult.OK) {string selected=picker.SelectedPath;string name=Path.GetFileName(selected.TrimEnd(Path.DirectorySeparatorChar));folder.Text=File.Exists(Path.Combine(selected,"EFT GPS.exe"))||name.Equals("EFT GPS",StringComparison.OrdinalIgnoreCase)||name.Equals("EFTGPS",StringComparison.OrdinalIgnoreCase)?selected:Path.Combine(selected,"EFT GPS");} };
        shortcut.SetBounds(28,365,764,26); shortcut.Text="Создать ярлык на рабочем столе"; shortcut.Checked=true; shortcut.Visible=!data && !updating; shortcut.Checked=!updating;
        components.SetBounds(28,400,764,72); components.ForeColor=muted;
        string runtime=RuntimeVersion();
        string systemStatus; try {CheckPlatform();systemStatus="✓ Windows и .NET Framework — готовы к работе";} catch(Exception e) {systemStatus="○ "+e.Message;}
        string componentDetails="КОМПОНЕНТЫ\n"+(runtime==null ? "○ WebView2 — установим из автономного пакета Microsoft" : "✓ WebView2 "+runtime+" — уже установлен")+"\n"+systemStatus+"\n✓ Node.js и модуль GPS — в комплекте. Отдельные драйверы не нужны.";
        components.Text="ПРОВЕРКА ГОТОВНОСТИ\n"+(systemStatus.StartsWith("✓")?"✓ Компьютер подходит для установки":systemStatus)+"\n"+(runtime==null?"○ Нужный компонент установится автоматически":"✓ Всё необходимое уже установлено");
        log.SetBounds(28,645,764,120); log.Visible=false;
        log.BackColor=Color.FromArgb(14,14,13); log.ForeColor=muted;  log.Font=new Font("Segoe UI",9);
        log.Text="Прогресс, личные метки и настройки GPS сохраняются при обновлении.\r\n"+(data ? "Для обновления справочника нужен интернет." : "Windows 10/11 x64 · .NET Framework 4.7.2 или новее.\r\nПеред заменой файлов создаётся резервная копия. Проверяем целостность каждого файла.");
        log.AppendText("\r\n\r\n"+componentDetails);
        status.SetBounds(28,484,690,28); status.ForeColor=ForeColor; status.Text="Всё готово к "+(data ? "обновлению базы" : updating ? "обновлению приложения" : "установке");
        percentage.SetBounds(720,484,72,28);percentage.Text="0%";percentage.TextAlign=ContentAlignment.MiddleRight;percentage.ForeColor=Color.FromArgb(185,171,130);
        fileStatus.SetBounds(28,516,764,25);fileStatus.AutoEllipsis=true;fileStatus.ForeColor=muted;fileStatus.Text="Файлы приложения и офлайн-база";
        progress.SetBounds(28,550,764,6);progress.AccessibleRole=AccessibleRole.ProgressBar;
        timing.SetBounds(28,567,764,28);timing.ForeColor=muted;
        details=ButtonAt("Подробнее",28,603,204,false);details.Height=30;
        details.Click+=delegate {expanded=!expanded;log.Visible=expanded;details.Text=NativeText.T(expanded?"Скрыть подробности":"Подробнее");int extra=expanded?132:0;ClientSize=new Size(ClientSize.Width,(int)Math.Round((720+extra)*DeviceDpi/96d));cancel.Top=(int)Math.Round((651+extra)*DeviceDpi/96d);action.Top=cancel.Top;};
        displayClock.Tick+=delegate {RenderTiming();};displayClock.Start();
        cancel=ButtonAt("Отмена",448,651,132,false); cancel.Visible=prepared;cancel.Click+=delegate {
            if(busy){if(cancellation!=null)cancellation.Cancel();status.Text=NativeText.T("Отменяем операцию…");cancel.Enabled=false;return;}
            if(prepared&&!complete&&!data&&!updating){prepared=false;recommended.Enabled=true;action.Text=NativeText.T("Далее");cancel.Visible=false;folder.ReadOnly=false;browse.Enabled=true;progress.Visible=percentage.Visible=timing.Visible=fileStatus.Visible=status.Visible=details.Visible=log.Visible=false;expanded=false;LayoutOperation(false);return;}
            Close();
        };
        action=ButtonAt(data ? "Обновить базу" : updating ? "Обновить приложение" : "Далее",592,651,200,true);
        progress.Visible=percentage.Visible=timing.Visible=fileStatus.Visible=status.Visible=details.Visible=false;
        action.Click+=async delegate {
            if(complete) {try{InstallerElevation.OpenApplication(target);Close();}catch(Exception e){status.Text=NativeText.T("Приложение установлено. Запустите его с ярлыка на рабочем столе.");Append(e.Message);}return;}
            try {
                target=Path.GetFullPath(folder.Text.Trim());
                if(String.IsNullOrWhiteSpace(folder.Text)) throw new IOException("Выберите папку приложения.");
                if(!data && !PackageInstaller.TargetAllowed(target)) throw new IOException("В этой папке уже есть другие файлы. Выберите пустую папку или папку EFT GPS.");
                CheckPlatform();
                if(!prepared){prepared=true;recommended.Enabled=false;action.Text=NativeText.T("Установить");cancel.Text=NativeText.T("Назад");cancel.Visible=true;folder.ReadOnly=true;browse.Enabled=false;status.Visible=true;status.Text=NativeText.T("Проверьте папку и нажмите «Установить».");return;}
                if(data||updating) using(var confirm=new InstallConfirmation(data ? "Обновить локальную базу?" : updating ? "Обновить EFT GPS?" : "Установить EFT GPS?",
                    "Папка: "+target+"\n\nОкно приложения будет закрыто перед обновлением. Автосъёмку GPS после запуска нужно будет включить заново.\n\n"+(data ? "Понадобится интернет. Предыдущая база будет сохранена." : updating ? "Проверим загруженный пакет и заменим файлы приложения. Резервная копия изменённых файлов будет сохранена." : "Проверим файлы и подготовим приложение.\nЯрлык на рабочем столе: "+(shortcut.Checked ? "создать / обновить" : "не создавать"))+"\nЛичный прогресс и настройки останутся на месте.",data || updating ? "Обновить" : "Установить")) if(confirm.ShowDialog(this)!=DialogResult.OK) return;
                writeShortcut=shortcut.Checked;
                cancellation=new CancellationTokenSource();busy=true;recommended.Enabled=false;elapsed.Restart();progress.Value=0; action.Enabled=false;cancel.Text=NativeText.T("Отмена");cancel.Enabled=true;cancel.Visible=true; browse.Enabled=false; folder.Enabled=false; shortcut.Enabled=false;
                progress.Visible=percentage.Visible=timing.Visible=fileStatus.Visible=status.Visible=details.Visible=true;
                LayoutOperation(true);
                steps.Text="✓  Подготовка     /     02  Установка     /     03  Готово"; status.Text="Подготовка файлов…"; progress.Running=data; NativeText.Apply(this);
                await Task.Run((Action)RunOperation);
                complete=true;elapsed.Stop(); progress.Value=100;percentage.Text="100%";fileStatus.Text="";RenderTiming(); steps.Text="✓  Подготовка     /     ✓  Установка     /     ✓  Готово";
                status.Text=data ? "База обновлена. Можно возвращаться в Тарков." : updating ? "Приложение обновлено. Всё готово к запуску." : "Приложение установлено. Всё готово к запуску.";
                action.Text="Открыть приложение"; cancel.Text="Закрыть";
            } catch(OperationCanceledException) {
                status.Text="Операция отменена. Файлы приложения восстановлены.";fileStatus.Text="";action.Text=data||updating?"Повторить":"Установить";folder.Enabled=true;shortcut.Enabled=true;
                Append("Отмена завершена. Личный прогресс сохранён.");
            } catch(Exception e) {
                status.Visible=true;details.Visible=true;
                status.Text="Не удалось завершить "+(data ? "обновление базы" : "установку");
                if(e.InnerException is UnauthorizedAccessException){status.Text="Нет прав записи в выбранную папку";fileStatus.Text="Выберите рекомендуемую папку или другое место установки.";fileStatus.Visible=true;}
                Append(e.Message+"\r\nИсправьте причину и повторите попытку. Личный прогресс не изменён.");
                try { string logs=File.Exists(Path.Combine(target,"Tarkov Offline.exe"))?Path.Combine(target,"userdata"):Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"EFTGPS","InstallerLogs");Directory.CreateDirectory(logs);File.WriteAllText(Path.Combine(logs,"maintenance-error.log"),e.ToString()); } catch {}
                action.Text="Повторить"; folder.Enabled=!updating; browse.Enabled=operation=="--setup"; shortcut.Enabled=true;
                if(!data&&!updating){prepared=false;folder.ReadOnly=false;recommended.Enabled=true;action.Text="Далее";cancel.Visible=false;}
            } finally { busy=false;elapsed.Stop();if(cancellation!=null){cancellation.Dispose();cancellation=null;}RenderTiming(); action.Enabled=true; cancel.Enabled=true; progress.Running=false; progress.Invalidate(); NativeText.Apply(this); }
        };
        FormClosing+=delegate(object sender,FormClosingEventArgs e) { if(busy) {e.Cancel=true;if(cancellation!=null)cancellation.Cancel();status.Text=NativeText.T("Отменяем операцию…");} };
        Controls.AddRange(new Control[]{folder,browse,shortcut,components,log,status,fileStatus,percentage,timing,progress,details,cancel,action});
        AcceptButton=action; CancelButton=cancel;
        var russian=ButtonAt("RU",650,28,66,false);
        var english=ButtonAt("EN",724,28,68,false);
        russian.Height=english.Height=32;
        russian.AccessibleName="Русский"; english.AccessibleName="English";
        Action refreshLanguageButtons=delegate {
            foreach(var button in new[]{russian,english}) {
                bool selected=(button==english)==NativeText.English;
                button.BackColor=selected ? Color.FromArgb(185,171,130) : Color.FromArgb(17,17,17);
                button.ForeColor=selected ? Color.Black : Color.Gainsboro;
                button.FlatAppearance.BorderColor=selected ? Color.FromArgb(185,171,130) : Color.FromArgb(67,66,59);
                button.FlatAppearance.MouseOverBackColor=selected ? Color.FromArgb(212,198,156) : Color.FromArgb(33,33,30);
                button.AccessibleDescription=selected ? "Selected / Выбран" : "";
            }
        };
        russian.Click+=delegate {NativeText.Select(false);refreshLanguageButtons();};
        english.Click+=delegate {NativeText.Select(true);refreshLanguageButtons();};
        Controls.AddRange(new Control[]{russian,english});russian.BringToFront();english.BringToFront();refreshLanguageButtons();
        if(data || updating || operation=="--install") {folder.ReadOnly=true; browse.Enabled=false;}
        if(updating) {browse.Visible=false;folder.Width=764;}
        Shown+=delegate {LayoutOperation(false);};
    }
    void LayoutOperation(bool running) {int extra=running&&expanded?132:0;int height=(running?720:600)+extra;ClientSize=new Size(ClientSize.Width,(int)Math.Round(height*DeviceDpi/96d));action.Top=cancel.Top=(int)Math.Round(((running?651:531)+extra)*DeviceDpi/96d);}
    void Append(string value) { if(IsDisposed) return; BeginInvoke((Action)delegate { log.AppendText("\r\n"+value); }); }
    void Report(InstallStatus value) {if(IsDisposed)return;BeginInvoke((Action)delegate {progress.Value=Math.Max(progress.Value,Math.Min(99,value.percent));progress.Invalidate();percentage.Text=progress.Value+"%";status.Text=NativeText.T(value.phase);fileStatus.Text=value.file;RenderTiming();});}
    string Duration(TimeSpan value) {return ((int)value.TotalMinutes).ToString("00")+":"+value.Seconds.ToString("00");}
    void RenderTiming() {
        string text=NativeText.T("Прошло: ")+Duration(elapsed.Elapsed);
        if(complete) text=NativeText.T("Время установки: ")+Duration(elapsed.Elapsed);
        else if(busy) text+="  ·  "+(progress.Value>=8 && elapsed.Elapsed.TotalSeconds>=5 ? NativeText.T("Осталось примерно: ")+Duration(TimeSpan.FromSeconds(Math.Min(86400,elapsed.Elapsed.TotalSeconds*(100-progress.Value)/progress.Value))) : NativeText.T("Оцениваем оставшееся время…"));
        timing.Text=text;
    }
    protected override void Dispose(bool disposing) {if(disposing)displayClock.Dispose();base.Dispose(disposing);}
    static void CheckPlatform() {
        if(!Environment.Is64BitOperatingSystem || Environment.OSVersion.Platform!=PlatformID.Win32NT) throw new IOException("Для приложения нужна 64-разрядная Windows 10 или 11.");
        using(var windows=Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion")) {
            int build; if(windows==null || !Int32.TryParse(Convert.ToString(windows.GetValue("CurrentBuildNumber")),out build) || build<18362) throw new IOException("Для приложения нужна Windows 10 версии 1903 или новее, либо Windows 11 (x64).");
        }
        using(var key=Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full")) {
            if(key==null || Convert.ToInt32(key.GetValue("Release",0))<461808) throw new IOException("Необходим .NET Framework 4.7.2 или новее. Установите компонент через Центр обновления Windows и повторите установку.");
        }
    }
    static string RuntimeVersion() {
        const string client=@"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
        foreach(var hive in new Microsoft.Win32.RegistryHive[]{Microsoft.Win32.RegistryHive.LocalMachine,Microsoft.Win32.RegistryHive.CurrentUser})
            using(var registry=Microsoft.Win32.RegistryKey.OpenBaseKey(hive,Microsoft.Win32.RegistryView.Registry32))
            using(var key=registry.OpenSubKey(client)) { Version version; if(key!=null && Version.TryParse(Convert.ToString(key.GetValue("pv")),out version) && version.Major>0) return version.ToString(); }
        return null;
    }
    static void RequireSpace(string path, long bytes) {
        string root=Path.GetPathRoot(Path.GetFullPath(path));
        var drive=new DriveInfo(root);
        if(drive.IsReady && drive.AvailableFreeSpace<bytes) throw new IOException("Недостаточно места на диске "+root+". Для этого этапа нужно не менее "+Math.Ceiling(bytes/1073741824d)+" ГБ свободного места.");
    }
    void StopServer() {
        if(!File.Exists(Path.Combine(target,"EFT GPS.exe")))return;
        foreach (var p in Process.GetProcessesByName("TarkovDesktopHost")) {
                try { if (String.Equals(p.MainModule.FileName, Path.Combine(target, "runtime", "TarkovDesktopHost.exe"), StringComparison.OrdinalIgnoreCase) ) { p.CloseMainWindow(); if(!p.WaitForExit(10000)) throw new IOException("Сначала закройте окно EFT GPS"); } } catch (System.ComponentModel.Win32Exception) {}
        }
        try {
            var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:38471/api/desktop/stop");
            request.Method = "POST"; request.Timeout = 3000; request.ContentType = "application/json"; request.Headers["Origin"] = "http://127.0.0.1:38471";
            string instance;
            using (var sha = SHA256.Create()) instance = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(target.TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant()))).Replace("-", "").ToLowerInvariant();
            byte[] bytes = Encoding.UTF8.GetBytes("{\"instance\":\"" + instance + "\"}");
            request.ContentLength = bytes.Length;
            using (var output = request.GetRequestStream()) output.Write(bytes, 0, bytes.Length);
            using (var response = request.GetResponse()) {}
            Thread.Sleep(800);
        } catch (WebException e) {
            if (e.Status == WebExceptionStatus.ConnectFailure) return;
            var response=e.Response as HttpWebResponse;if(response!=null && response.StatusCode==HttpStatusCode.Conflict){response.Dispose();return;}
            throw new IOException("Не удалось завершить локальную службу. Закройте приложение и повторите через две минуты.", e);
        }
    }
    void RunOperation() {
        string identity;
        using(var sha=SHA256.Create()) identity=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(target).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant()))).Replace("-","");
        using(var installMutex=new Mutex(false,"Local\\EFTGPS-install-"+identity)) {
            bool acquired=false;
            try {
                try {acquired=installMutex.WaitOne(0);} catch(AbandonedMutexException) {acquired=true;}
                if(!acquired) throw new IOException("Обновление уже выполняется");
                RunOperationCore();
            } finally {if(acquired) installMutex.ReleaseMutex();}
        }
    }
    void RunOperationCore() {
        if (operation == "--data") {
            StopServer();
            var start = new ProcessStartInfo(Path.Combine(target, "runtime", "node.exe"), "\"" + Path.Combine(target, "scripts", "refresh.mjs") + "\"") { WorkingDirectory = target, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8 };
            using (var process = Process.Start(start)) {
                process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) Append(e.Data); };
                process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) Append(e.Data); };
                process.BeginOutputReadLine(); process.BeginErrorReadLine(); process.WaitForExit();
                if (process.ExitCode != 0) throw new IOException("Загрузка базы не завершена. Предыдущая база осталась на месте.");
            }
            return;
        }
        Append("Проверяем доступ к выбранной папке…");
        InstallWorkspace workspace=PackageInstaller.PrepareWorkspace(target);
        Append("Проверяем пакет и распаковываем файлы за один проход.");
        bool embedded = package == null;
        string staged = workspace.Stage;
        try {
            if(updating) PackageInstaller.CheckUpdateHash(package,expectedHash,cancellation.Token);
            Report(new InstallStatus {phase="Проверка пакета",percent=1});
            ReleaseInfo release;
            if(embedded) {using(var input=OpenEmbeddedPackage()) release=PackageInstaller.Stage(input,staged,Append,Report,cancellation.Token);}
            else release=PackageInstaller.Stage(package,staged,Append,Report,cancellation.Token);
            if(updating) PackageInstaller.CheckUpdateVersion(target,release,expectedVersion);
            long unpacked=0; foreach(var file in release.files) unpacked+=file.size;
            if(File.Exists(Path.Combine(target,"package.json"))) RequireSpace(target,unpacked+256L*1024*1024);
            EnsureRuntime(staged);
            cancellation.Token.ThrowIfCancellationRequested();
            StopServer();
            string backup = PackageInstaller.Install(target, staged, release, Append,Report,cancellation.Token,delegate {InstallerElevation.PrepareUserData(target);});
            Append("Установлена версия " + release.version + ". Резервная копия изменённых файлов: " + backup);
            if(writeShortcut) CreateShortcut();
            if(updating) { try {File.Delete(package);} catch {} }
        } finally {
            try {
                workspace.Dispose();
            } catch(Exception cleanup) {Append("Не удалось удалить временные файлы: "+cleanup.Message);}
        }
    }
    Stream OpenEmbeddedPackage() {
        var input=File.OpenRead(Application.ExecutablePath);
        try {
            if(input.Length<49) throw new IOException("Не найден пакет установки");
            input.Position=input.Length-49;var reader=new BinaryReader(input);long size=reader.ReadInt64();byte[] expected=reader.ReadBytes(32);
            if(Encoding.ASCII.GetString(reader.ReadBytes(9))!="TKVSETUP1" || size<=0 || size>input.Length-49) throw new IOException("Повреждён установщик");
            var view=new PackageView(input,input.Length-49-size,size);
            using(var sha=SHA256.Create()) {var buffer=new byte[1024*1024];long read=0;int count;var clock=Stopwatch.StartNew();while((count=view.Read(buffer,0,buffer.Length))>0){cancellation.Token.ThrowIfCancellationRequested();sha.TransformBlock(buffer,0,count,buffer,0);read+=count;if(clock.ElapsedMilliseconds>100){Report(new InstallStatus {phase="Проверка пакета",percent=(int)(read*9/size)});clock.Restart();}}sha.TransformFinalBlock(new byte[0],0,0);if(BitConverter.ToString(sha.Hash)!=BitConverter.ToString(expected))throw new IOException("Установщик повреждён");}
            view.Position=0;return view;
        } catch {input.Dispose();throw;}
    }
    void EnsureRuntime(string staged) {
        if(RuntimeVersion()!=null) { Append("WebView2 уже установлен. Повторная установка не требуется."); return; }
        string installer=Path.Combine(staged,"runtime","MicrosoftEdgeWebView2RuntimeInstallerX64.exe");
        if(!File.Exists(installer)) throw new IOException("В пакете нет автономного установщика WebView2. Используйте полный установщик EFT GPS.");
        Append("Установка Microsoft WebView2 из автономного пакета…");
        using(var process=Process.Start(new ProcessStartInfo(installer,"/silent /install") {UseShellExecute=false,CreateNoWindow=true})) {
            process.WaitForExit();
            if(process.ExitCode!=0 && process.ExitCode!=3010) throw new IOException("WebView2 не установлен. Код Microsoft: "+process.ExitCode+". Проверьте права доступа и повторите установку.");
            if(RuntimeVersion()==null) throw new IOException("WebView2 ещё не готов к работе. Перезагрузите Windows и повторите установку.");
        }
        Append("Microsoft WebView2 установлен.");
    }
    void CreateShortcut() {
        Type type = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(type);
        string location = Path.Combine(InstallerElevation.Desktop, "T_S_U_Y_U EFT GPS.lnk");
        object shortcut = type.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { location });
        shortcut.GetType().InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { Path.Combine(target, "EFT GPS.exe") });
        shortcut.GetType().InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { target });
        shortcut.GetType().InvokeMember("IconLocation", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { Path.Combine(target, "public", "icons", "app.ico") + ",0" });
        shortcut.GetType().InvokeMember("Save", System.Reflection.BindingFlags.InvokeMethod, null, shortcut, null);
    }
}



