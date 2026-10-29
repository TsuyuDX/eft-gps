using System;using System.IO;using System.Drawing;using System.Drawing.Drawing2D;using System.Drawing.Imaging;
class BuildSecretIcon {
 static byte[] Draw(int size) {using(var bitmap=new Bitmap(size,size,PixelFormat.Format32bppArgb)) {using(var g=Graphics.FromImage(bitmap)) {
 g.SmoothingMode=SmoothingMode.AntiAlias;g.ScaleTransform(size/96f,size/96f);
 using(var bg=new SolidBrush(Color.FromArgb(35,37,43)))g.FillEllipse(bg,1,1,94,94);
 using(var p=new GraphicsPath()){p.AddBezier(48,85,41,72,18,58,18,39);p.AddArc(18,9,60,60,180,180);p.AddBezier(78,39,78,58,55,72,48,85);p.CloseFigure();using(var b=new SolidBrush(Color.FromArgb(252,63,66)))g.FillPath(b,p);}
 using(var b=new SolidBrush(Color.White))g.FillPolygon(b,new PointF[]{new PointF(33,24),new PointF(41,24),new PointF(41,53),new PointF(56,24),new PointF(64,24),new PointF(64,63),new PointF(56,63),new PointF(56,36),new PointF(41,63),new PointF(33,63)});
 using(var pen=new Pen(Color.FromArgb(167,157,117),2)){g.DrawLine(pen,48,2,48,7);g.DrawLine(pen,48,89,48,94);g.DrawLine(pen,2,48,10,48);g.DrawLine(pen,86,48,94,48);}
 }using(var stream=new MemoryStream()){bitmap.Save(stream,ImageFormat.Png);return stream.ToArray();}}}
 static void Main(string[] args){string folder=args[0];File.WriteAllBytes(Path.Combine(folder,"index-maps-192.png"),Draw(192));var png=Draw(64);using(var w=new BinaryWriter(File.Create(Path.Combine(folder,"index-maps.ico")))){w.Write((ushort)0);w.Write((ushort)1);w.Write((ushort)1);w.Write((byte)64);w.Write((byte)64);w.Write((byte)0);w.Write((byte)0);w.Write((ushort)1);w.Write((ushort)32);w.Write((uint)png.Length);w.Write((uint)22);w.Write(png);}}
}
