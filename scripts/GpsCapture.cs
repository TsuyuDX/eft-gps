using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

// Sends only the configured screenshot key, and only to the foreground EFT window.
// This helper never attaches to the game or reads its memory.
class GpsCapture {
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count,INPUT[] inputs,int size);
 [StructLayout(LayoutKind.Sequential)] struct INPUT {public uint type;public InputUnion data;}
 [StructLayout(LayoutKind.Explicit)] struct InputUnion {[FieldOffset(0)] public KEYBDINPUT keyboard;[FieldOffset(0)] public MOUSEINPUT mouse;}
 [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT {public ushort key;public ushort scan;public uint flags;public uint time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT {public int x;public int y;public uint mouseData;public uint flags;public uint time;public UIntPtr extra;}
 static volatile bool running=true;
 static string Argument(string[] args,string name,string fallback){int index=Array.IndexOf(args,name);return index>=0&&index+1<args.Length?args[index+1]:fallback;}
 static bool GameFocused(){try{uint pid;GetWindowThreadProcessId(GetForegroundWindow(),out pid);return Process.GetProcessById((int)pid).ProcessName.Equals("EscapeFromTarkov",StringComparison.OrdinalIgnoreCase);}catch{return false;}}
 static bool ParentAlive(int pid){try{return !Process.GetProcessById(pid).HasExited;}catch{return false;}}
 static ushort Key(string name){switch(name){case "F12":return 0x7B;case "F11":return 0x7A;case "Insert":return 0x2D;case "PrintScreen":return 0x2C;default:throw new Exception("Unsupported screenshot key");}}
 static bool Press(ushort key){var down=new INPUT{type=1,data=new InputUnion{keyboard=new KEYBDINPUT{key=key}}};var up=new INPUT{type=1,data=new InputUnion{keyboard=new KEYBDINPUT{key=key,flags=2}}};bool ok=SendInput(1,new[]{down},Marshal.SizeOf(typeof(INPUT)))==1;Thread.Sleep(40);return SendInput(1,new[]{up},Marshal.SizeOf(typeof(INPUT)))==1&&ok;}
 [STAThread] static int Main(string[] args){
  Console.OutputEncoding=new System.Text.UTF8Encoding(false);
  try {
   if(Array.IndexOf(args,"--pick-folder")>=0){using(var dialog=new FolderBrowserDialog()){dialog.Description="Выберите папку скриншотов Tarkov или папку Logs";dialog.ShowNewFolderButton=false;if(dialog.ShowDialog()==DialogResult.OK)Console.WriteLine(dialog.SelectedPath);}return 0;}
   if(Array.IndexOf(args,"--self-test")>=0){Console.WriteLine("input-size="+Marshal.SizeOf(typeof(INPUT))+"; focus-filter=EscapeFromTarkov; no-input-sent");return 0;}
   int interval=int.Parse(Argument(args,"--interval","2000")),parent=int.Parse(Argument(args,"--parent","0"));ushort key=Key(Argument(args,"--key","PrintScreen"));if(interval<1000||interval>30000||parent<=0)throw new Exception("Invalid arguments");
   var thread=new Thread(()=>{try{while(Console.ReadLine()!=null){running=false;return;}}catch{}running=false;});thread.IsBackground=true;thread.Start();
   long last=0;string previous="";var clock=Stopwatch.StartNew();
   while(running&&ParentAlive(parent)){bool focused=GameFocused();string state=focused?"capturing":"paused";if(state!=previous){Console.WriteLine(state);previous=state;}if(focused&&clock.ElapsedMilliseconds-last>=interval){last=clock.ElapsedMilliseconds;if(!Press(key))Console.WriteLine("input-blocked");}Thread.Sleep(100);}
   return 0;
  }catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}
 }
}
