using System;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
class PackRelease {
    class FileEntry { public string path; public long size; public string sha256; }
    class Release { public FileEntry[] files; }
    static void Main(string[] args) {
        string root = Path.GetFullPath(args[0]), manifest = File.ReadAllText(args[1]), zip = args[2], setup = args[3];
        var release = new JavaScriptSerializer { MaxJsonLength = 32 * 1024 * 1024 }.Deserialize<Release>(manifest);
        using (var output = File.Create(zip)) using (var archive = new ZipArchive(output, ZipArchiveMode.Create)) {
            foreach (var file in release.files) {
                string full = Path.GetFullPath(Path.Combine(root, file.path.Replace('/', Path.DirectorySeparatorChar)));
                if (!full.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("Invalid release path");
                if(new FileInfo(full).Length!=file.size) throw new IOException("Source size mismatch: "+file.path);
                var entry = archive.CreateEntry(file.path, CompressionLevel.Fastest);
                entry.LastWriteTime = new DateTimeOffset(2020,1,1,0,0,0,TimeSpan.Zero);
                using(var sha=SHA256.Create()) using (var input = File.OpenRead(full)) using (var target = entry.Open()) {
                    byte[] buffer=new byte[1024*1024];int count;
                    while((count=input.Read(buffer,0,buffer.Length))>0){sha.TransformBlock(buffer,0,count,buffer,0);target.Write(buffer,0,count);}
                    sha.TransformFinalBlock(new byte[0],0,0);
                    if(BitConverter.ToString(sha.Hash).Replace("-", "").ToLowerInvariant()!=file.sha256) throw new IOException("Source checksum mismatch: "+file.path);
                }
            }
            var infoEntry=archive.CreateEntry("release.json");infoEntry.LastWriteTime=new DateTimeOffset(2020,1,1,0,0,0,TimeSpan.Zero);
            using (var writer = new StreamWriter(infoEntry.Open(), new UTF8Encoding(false))) writer.Write(manifest);
        }
        byte[] hash;
        using (var sha = SHA256.Create()) using (var input = File.OpenRead(zip)) hash = sha.ComputeHash(input);
        if(setup=="-") {Console.WriteLine("Delta ready: "+new FileInfo(zip).Length+" bytes");return;}
        using (var output = File.Create(setup)) {
            using (var stub = File.OpenRead(args.Length > 4 ? args[4] : Path.Combine(root, "runtime", "TarkovMaintenance.exe"))) stub.CopyTo(output);
            using (var payload = File.OpenRead(zip)) payload.CopyTo(output);
            var writer = new BinaryWriter(output);
            writer.Write(new FileInfo(zip).Length); writer.Write(hash); writer.Write(Encoding.ASCII.GetBytes("TKVSETUP1")); writer.Flush();
        }
        File.WriteAllText(zip + ".sha256", BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant() + "  " + Path.GetFileName(zip) + "\n");
        using (var sha = SHA256.Create()) using (var input = File.OpenRead(setup)) File.WriteAllText(setup + ".sha256", BitConverter.ToString(sha.ComputeHash(input)).Replace("-", "").ToLowerInvariant() + "  " + Path.GetFileName(setup) + "\n");
        Console.WriteLine("Release ready: " + new FileInfo(zip).Length + " bytes");
    }
}
