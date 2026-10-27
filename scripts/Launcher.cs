using System;
using System.IO;
using System.Diagnostics;
using System.Net;
using System.Threading;
using System.Windows.Forms;
class Launcher {
 [STAThread] static void Main() {
  string root=AppDomain.CurrentDomain.BaseDirectory;
  string url="http://127.0.0.1:38471";
  try {
   bool running=Healthy(url);
   if(!running){
    var start=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),"\""+Path.Combine(root,"server.mjs")+"\" --desktop");
    start.WorkingDirectory=root;start.UseShellExecute=false;start.CreateNoWindow=true;
    Process.Start(start);
    for(int i=0;i<80&&!running;i++){Thread.Sleep(150);running=Healthy(url);}
   }
   if(!running)throw new Exception("Не удалось запустить локальное приложение. Проверьте, что архив распакован полностью, а порт 38471 свободен.");
   string edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe");
   if(!File.Exists(edge))edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Microsoft","Edge","Application","msedge.exe");
   if(File.Exists(edge))Process.Start(new ProcessStartInfo(edge,"--app="+url+" --window-size=1440,950"){UseShellExecute=false,CreateNoWindow=true});
   else Process.Start(new ProcessStartInfo(url){UseShellExecute=true});
  }catch(Exception e){MessageBox.Show(e.Message,"Tarkov Offline",MessageBoxButtons.OK,MessageBoxIcon.Error);}
 }
 static bool Healthy(string url){try{var req=WebRequest.Create(url+"/api/health");req.Timeout=400;using(var response=req.GetResponse())using(var reader=new StreamReader(response.GetResponseStream()))return reader.ReadToEnd().Contains("TarkovOffline");}catch{return false;}}
}
