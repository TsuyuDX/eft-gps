using System;using System.IO;using System.Text;using System.Drawing;using System.Drawing.Drawing2D;using System.Drawing.Imaging;
// Flat vector artwork. BuildIcon.cs packages the result into Windows ICO and PNG sizes.
class BuildMinimalIcon {
 static void Main(string[] args){
  string output=args.Length==1?args[0]:"public/icons";Directory.CreateDirectory(output);
  string svg="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"><rect width=\"64\" height=\"64\" rx=\"14\" fill=\"#191c1a\"/><g fill=\"none\" stroke=\"#c9bf9f\" stroke-width=\"2\" stroke-linecap=\"round\"><circle cx=\"32\" cy=\"32\" r=\"20\"/><path d=\"M32 7v9M32 48v9M7 32h9M48 32h9\"/></g><path d=\"M24 23h16v4h-6v15h-4V27h-6Z\" fill=\"#e6dfca\"/></svg>";
  File.WriteAllText(Path.Combine(output,"app.svg"),svg,new UTF8Encoding(false));
  using(var bitmap=new Bitmap(1024,1024,PixelFormat.Format32bppArgb)){
   using(var g=Graphics.FromImage(bitmap)){
    g.SmoothingMode=SmoothingMode.AntiAlias;g.Clear(Color.Transparent);g.ScaleTransform(16,16);
    using(var bg=new SolidBrush(Color.FromArgb(25,28,26)))using(var rounded=new GraphicsPath()){
     rounded.AddArc(0,0,28,28,180,90);rounded.AddArc(36,0,28,28,270,90);rounded.AddArc(36,36,28,28,0,90);rounded.AddArc(0,36,28,28,90,90);rounded.CloseFigure();g.FillPath(bg,rounded);
    }
    using(var pen=new Pen(Color.FromArgb(201,191,159),2)){pen.StartCap=pen.EndCap=LineCap.Round;g.DrawEllipse(pen,12,12,40,40);g.DrawLine(pen,32,7,32,16);g.DrawLine(pen,32,48,32,57);g.DrawLine(pen,7,32,16,32);g.DrawLine(pen,48,32,57,32);}
    using(var ink=new SolidBrush(Color.FromArgb(230,223,202)))g.FillPolygon(ink,new PointF[]{new PointF(24,23),new PointF(40,23),new PointF(40,27),new PointF(34,27),new PointF(34,42),new PointF(30,42),new PointF(30,27),new PointF(24,27)});
   }
   bitmap.Save(Path.Combine(output,"app-source.png"),ImageFormat.Png);
  }
  Console.WriteLine("Created flat T/reticle SVG and 1024px PNG source.");
 }
}
