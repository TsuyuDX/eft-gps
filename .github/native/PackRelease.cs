using System;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
class PackRelease {
    class FileEntry { public string path; }
    class Release { public FileEntry[] files; }
    static void Main(string[] args) {
        string root = Path.GetFullPath(args[0]), manifest = File.ReadAllText(args[1]), zip = args[2], setup = args[3];
        var release = new JavaScriptSerializer { MaxJsonLength = 32 * 1024 * 1024 }.Deserialize<Release>(manifest);
        using (var output = File.Create(zip)) using (var archive = new ZipArchive(output, ZipArchiveMode.Create)) {
            foreach (var file in release.files) {
                string full = Path.GetFullPath(Path.Combine(root, file.path.Replace('/', Path.DirectorySeparatorChar)));
                if (!full.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("Invalid release path");
                var entry = archive.CreateEntry(file.path, CompressionLevel.Fastest);
                using (var input = File.OpenRead(full)) using (var target = entry.Open()) input.CopyTo(target);
            }
            using (var writer = new StreamWriter(archive.CreateEntry("release.json").Open(), new UTF8Encoding(false))) writer.Write(manifest);
        }
        byte[] hash;
        using (var sha = SHA256.Create()) using (var input = File.OpenRead(zip)) hash = sha.ComputeHash(input);
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
