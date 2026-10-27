using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Collections.Generic;

// Packaging only: the source artwork is retained unchanged alongside the icon.
class BuildIcon {
    static byte[] Resize(Image source, int size) {
        using (var bitmap = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
            using (var graphics = Graphics.FromImage(bitmap)) {
                graphics.CompositingMode = CompositingMode.SourceCopy;
                graphics.CompositingQuality = CompositingQuality.HighQuality;
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                using (var attributes = new ImageAttributes()) {
                    attributes.SetWrapMode(WrapMode.TileFlipXY);
                    graphics.DrawImage(source, new Rectangle(0,0,size,size), 0,0,source.Width,source.Height, GraphicsUnit.Pixel, attributes);
                }
            }
            using (var stream = new MemoryStream()) { bitmap.Save(stream, ImageFormat.Png); return stream.ToArray(); }
        }
    }
    static int Main(string[] args) {
        if (args.Length != 2) { Console.Error.WriteLine("BuildIcon <source PNG> <output directory>"); return 1; }
        Directory.CreateDirectory(args[1]);
        using (var source = Image.FromFile(args[0])) {
            int[] sizes = {16,24,32,48,64,128,256};
            var frames = new List<byte[]>();
            foreach (int size in sizes) frames.Add(Resize(source,size));
            using (var writer = new BinaryWriter(File.Create(Path.Combine(args[1],"app.ico")))) {
                writer.Write((ushort)0); writer.Write((ushort)1); writer.Write((ushort)sizes.Length);
                int offset = 6 + 16 * sizes.Length;
                for (int i=0;i<sizes.Length;i++) {
                    writer.Write((byte)(sizes[i] == 256 ? 0 : sizes[i])); writer.Write((byte)(sizes[i] == 256 ? 0 : sizes[i]));
                    writer.Write((byte)0); writer.Write((byte)0); writer.Write((ushort)1); writer.Write((ushort)32);
                    writer.Write(frames[i].Length); writer.Write(offset); offset += frames[i].Length;
                }
                foreach (var frame in frames) writer.Write(frame);
            }
            foreach (int size in new[]{64,192,512}) File.WriteAllBytes(Path.Combine(args[1],"app-"+size+".png"),Resize(source,size));
        }
        Console.WriteLine("Created ICO: 16,24,32,48,64,128,256; PNG: 64,192,512");
        return 0;
    }
}
