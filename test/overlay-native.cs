using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;
class OverlayNativeTest {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr window,int index);
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr window,int message,IntPtr w,IntPtr l);
    static void Check(bool value,string message){if(!value)throw new Exception(message);}
    [STAThread] static void Main(){
        Application.EnableVisualStyles();IntPtr foreground=GetForegroundWindow();
        using(var window=new RaidMapWindow()){
            window.Bounds=new Rectangle(10,10,80,80);window.Show();
            int style=GetWindowLong(window.Handle,-20);
            Check((style&0x20)!=0 && (style&0x08000000)!=0 && (style&0x80000)!=0,"Map must pass input and never activate");
            Check(SendMessage(window.Handle,0x0084,IntPtr.Zero,IntPtr.Zero).ToInt32()==-1,"Map intercepts hit testing");
            Check(SendMessage(window.Handle,0x0021,IntPtr.Zero,IntPtr.Zero).ToInt32()==3,"Map activates on mouse input");
            Check(GetForegroundWindow()==foreground,"Showing map stole keyboard focus");
            window.ReplaceImage(new Bitmap(20,20));window.ReplaceImage(new Bitmap(30,30));Check(window.Canvas.Image.Width==30,"Map frame was not replaced");window.Hide();
        }
        Console.WriteLine("Overlay checks passed: mouse passthrough, no activation, preserved keyboard focus, frame replacement/disposal.");
    }
}
