using System;
using System.IO;
using System.Net;
using System.Text;
using System.Drawing;
using System.Windows.Forms;
using System.Reflection;
using System.Globalization;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

public class DownloadPart { public string name,sha256; public long size; }
public class DownloadManifest { public int format; public string version,output,sha256; public long size; public DownloadPart[] parts; }
public static class DownloadSetup {
 public static string Hex(byte[] value){return BitConverter.ToString(value).Replace("-","").ToLowerInvariant();}
 public static DownloadManifest ReadManifest(){using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream("setup-parts.json"))using(var reader=new StreamReader(input,Encoding.UTF8)){var value=new JavaScriptSerializer().Deserialize<DownloadManifest>(reader.ReadToEnd());Validate(value);return value;}}
 public static void Validate(DownloadManifest value){
  Version version; if(value==null||value.format!=1||!Version.TryParse(value.version,out version)||!Regex.IsMatch(value.version,@"^[0-9]+\.[0-9]+\.[0-9]+$")||!Regex.IsMatch(value.output??"",@"^[A-Za-z0-9.-]+-Setup\.exe$")||!Regex.IsMatch(value.sha256??"",@"^[a-f0-9]{64}$")||value.parts==null||value.parts.Length<1||value.parts.Length>16)throw new IOException("Invalid embedded download manifest.");
  long total=0;for(int index=0;index<value.parts.Length;index++){var part=value.parts[index];if(part.name!=value.output+".part"+(index+1).ToString("00")||part.size<1||part.size>=2L*1024*1024*1024||!Regex.IsMatch(part.sha256??"",@"^[a-f0-9]{64}$"))throw new IOException("Invalid download part.");total+=part.size;}if(total!=value.size||total>8L*1024*1024*1024)throw new IOException("Invalid package size.");
 }
 public static string CopyPart(Stream input,Stream output,long expected,string digest,CancellationToken token,Action<long> progress){
  using(var hash=SHA256.Create()) {var buffer=new byte[81920];long copied=0;while(copied<expected){token.ThrowIfCancellationRequested();int count=input.Read(buffer,0,(int)Math.Min(buffer.Length,expected-copied));if(count==0)throw new IOException("The download is incomplete.");hash.TransformBlock(buffer,0,count,buffer,0);output.Write(buffer,0,count);copied+=count;if(progress!=null)progress(copied);}hash.TransformFinalBlock(new byte[0],0,0);string actual=Hex(hash.Hash);if(actual!=digest)throw new IOException("Package checksum mismatch. Please retry the download.");return actual;}
 }
 public static string Download(DownloadManifest manifest,CancellationToken token,Action<long,int> progress){
  return DownloadTo(manifest,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"EFTGPS-Installer",manifest.version),token,progress);
 }
 public static string DownloadTo(DownloadManifest manifest,string cache,CancellationToken token,Action<long,int> progress){
  Validate(manifest);Directory.CreateDirectory(cache);string file=Path.Combine(cache,manifest.output);
  long cachedLength=File.Exists(file)?new FileInfo(file).Length:0;
  long[] offsets=new long[manifest.parts.Length],received=new long[manifest.parts.Length];long offset=0;for(int i=0;i<offsets.Length;i++){offsets[i]=offset;offset+=manifest.parts[i].size;}
  using(var initial=new FileStream(file,FileMode.OpenOrCreate,FileAccess.Write,FileShare.ReadWrite))initial.SetLength(manifest.size);
  var notifyLock=new object();
  Action<int,long> report=delegate(int index,long count){lock(notifyLock){received[index]=count;long total=0;foreach(long size in received)total+=size;if(progress!=null)progress(total,index);}};
  try {
   Parallel.For(0,manifest.parts.Length,new ParallelOptions{MaxDegreeOfParallelism=3,CancellationToken=token},delegate(int index){
    token.ThrowIfCancellationRequested();var part=manifest.parts[index];bool cached=false;
    using(var target=new FileStream(file,FileMode.Open,FileAccess.ReadWrite,FileShare.ReadWrite,128*1024,FileOptions.SequentialScan)) {
     target.Position=offsets[index];if(cachedLength>=offsets[index]+part.size)try{CopyPart(target,Stream.Null,part.size,part.sha256,token,null);cached=true;}catch(IOException){}
     if(!cached){target.Position=offsets[index];var request=(HttpWebRequest)WebRequest.Create("https://github.com/TsuyuDX/eft-gps/releases/download/v"+manifest.version+"/"+Uri.EscapeDataString(part.name));request.UserAgent="EFTGPS-Installer/"+manifest.version;request.Timeout=30000;request.ReadWriteTimeout=60000;
      using(token.Register(delegate{request.Abort();}))try{using(var response=(HttpWebResponse)request.GetResponse())using(var input=response.GetResponseStream()){if(response.StatusCode!=HttpStatusCode.OK||response.ContentLength>=0&&response.ContentLength!=part.size)throw new IOException("Unexpected download size.");CopyPart(input,target,part.size,part.sha256,token,delegate(long count){report(index,count);});}}
      catch{if(token.IsCancellationRequested)throw new OperationCanceledException();throw;}
     }
     report(index,part.size);
    }
   });
  }catch(AggregateException error){throw error.Flatten().InnerExceptions[0];}
  token.ThrowIfCancellationRequested();using(var hash=SHA256.Create())using(var input=File.OpenRead(file))if(Hex(hash.ComputeHash(input))!=manifest.sha256)throw new IOException("Final setup checksum mismatch.");return file;
 }

 static void SelfTest(){
  var bytes=Encoding.UTF8.GetBytes("EFT GPS package fixture");string hash;using(var sha=SHA256.Create())hash=Hex(sha.ComputeHash(bytes));using(var input=new MemoryStream(bytes))using(var output=new MemoryStream()){CopyPart(input,output,bytes.Length,hash,CancellationToken.None,null);if(Encoding.UTF8.GetString(output.ToArray())!="EFT GPS package fixture")throw new Exception("Copy failed");}
  bool corrupt=false;try{CopyPart(new MemoryStream(bytes),Stream.Null,bytes.Length,new string('0',64),CancellationToken.None,null);}catch(IOException){corrupt=true;}if(!corrupt)throw new Exception("Corruption was accepted");
  bool truncated=false;try{CopyPart(new MemoryStream(bytes),Stream.Null,bytes.Length+1,hash,CancellationToken.None,null);}catch(IOException){truncated=true;}if(!truncated)throw new Exception("Truncation was accepted");
  var cancellation=new CancellationTokenSource();cancellation.Cancel();bool cancelled=false;try{CopyPart(new MemoryStream(bytes),Stream.Null,bytes.Length,hash,cancellation.Token,null);}catch(OperationCanceledException){cancelled=true;}if(!cancelled)throw new Exception("Cancellation was ignored");ReadManifest();
  var fixture=new DownloadManifest{format=1,version="0.0.0",output="EFTGPS-Test-Setup.exe",size=bytes.Length,sha256=hash,parts=new[]{new DownloadPart{name="EFTGPS-Test-Setup.exe.part01",size=bytes.Length,sha256=hash}}};
  string cache=Path.Combine(Path.GetTempPath(),"eftgps-download-test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(cache);string cached=Path.Combine(cache,fixture.output);
  try{File.WriteAllBytes(cached,bytes);long loaded=0;string restored=DownloadTo(fixture,cache,CancellationToken.None,delegate(long value,int index){loaded=value;});if(restored!=cached||loaded!=bytes.Length||File.ReadAllBytes(cached).Length!=bytes.Length)throw new Exception("Verified cache resume failed");fixture.output="../EFTGPS-Test-Setup.exe";bool rejected=false;try{Validate(fixture);}catch(IOException){rejected=true;}if(!rejected)throw new Exception("Unsafe file name was accepted");}finally{File.Delete(cached);Directory.Delete(cache);}
 }
 [STAThread] public static void Main(string[] args){try{AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling",false);AppContext.SetSwitch("Switch.System.IO.BlockLongPaths",false);ServicePointManager.SecurityProtocol|=SecurityProtocolType.Tls12;ServicePointManager.DefaultConnectionLimit=6;if(args.Length==1&&args[0]=="--self-test"){SelfTest();Environment.Exit(0);return;}NativeText.English=CultureInfo.CurrentUICulture.TwoLetterISOLanguageName!="ru";Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new DownloadWindow(ReadManifest()));}catch(Exception error){if(args.Length>0){Environment.Exit(1);return;}MessageBox.Show(error.Message,NativeText.Brand,MessageBoxButtons.OK,MessageBoxIcon.Error);}}
}
class DownloadWindow : DarkWindow {
 readonly DownloadManifest manifest; readonly Label title,subtitle,phase,details; readonly InstallProgress progress=new InstallProgress();readonly CheckBox cleanup=new DarkCheckBox(); readonly Button install,cancel,russian,english; readonly Stopwatch elapsed=new Stopwatch(); readonly System.Windows.Forms.Timer displayClock=new System.Windows.Forms.Timer {Interval=500};
 CancellationTokenSource cancellation;bool busy,closeRequested;long received;int partIndex;string failure;
 string L(string ru,string en){return NativeText.English?en:ru;}
 string ByteSize(long bytes){return (bytes/1000000000.0).ToString("0.00",CultureInfo.GetCultureInfo(NativeText.English?"en-US":"ru-RU"))+" GB";}
 public DownloadWindow(DownloadManifest value){
  manifest=value;ClientSize=new Size(820,530);
  using(var resource=Assembly.GetExecutingAssembly().GetManifestResourceStream("installer-logo.png"))using(var image=Image.FromStream(resource))Controls.Add(new PictureBox{Image=new Bitmap(image),SizeMode=PictureBoxSizeMode.Zoom,Bounds=new Rectangle(28,24,62,62)});
  TextAt(NativeText.Brand,106,22,520,40,22,ForeColor);TextAt("Windows 10 / 11 · x64  /  "+manifest.version,108,67,530,24,9,Color.FromArgb(157,157,147));
  russian=ButtonAt("RU",650,28,66,false);english=ButtonAt("EN",724,28,68,false);russian.Height=english.Height=32;russian.AccessibleName="Русский";english.AccessibleName="English";
  russian.Click+=delegate{NativeText.English=false;Render();};english.Click+=delegate{NativeText.English=true;Render();};
  title=TextAt("",28,142,764,43,20,ForeColor);subtitle=TextAt("",28,199,764,72,10,Color.FromArgb(157,157,147));phase=TextAt("",28,294,764,48,11,ForeColor);details=TextAt("",28,344,764,30,10,Color.FromArgb(185,171,130));progress.SetBounds(28,386,764,4);progress.Visible=false;
  cleanup.SetBounds(28,409,764,28);cleanup.Checked=true;cancel=ButtonAt("",448,462,132,false);install=ButtonAt("",592,462,200,true);
  cancel.Click+=delegate{if(busy)cancellation.Cancel();else Close();};install.Click+=async delegate{await StartDownload();};
  Controls.AddRange(new Control[]{russian,english,progress,cleanup,cancel,install});russian.BringToFront();english.BringToFront();displayClock.Tick+=delegate{if(busy)ProgressText();};displayClock.Start();AcceptButton=install;CancelButton=cancel;
  FormClosing+=delegate(object sender,FormClosingEventArgs e){if(busy){closeRequested=true;e.Cancel=true;cancellation.Cancel();}};Render();
 }
 void Render(){
  Text=NativeText.Brand+" "+manifest.version+L(" · Загрузка"," · Download");title.Text=L("Один файл — обычная установка.","One download. Familiar setup.");subtitle.Text=L("Скачаем файлы и откроем установку.\nПосле установки карты и справочник доступны без интернета.","We will download the files and open setup.\nAfter installation, maps and reference data are available offline.");
  cleanup.Text=L("Удалить временный пакет после закрытия установщика","Remove the temporary package after setup closes");cancel.Text=busy?L("Остановить","Stop"):L("Закрыть","Close");install.Text=failure==null?L("Скачать и установить","Download and install"):L("Повторить","Retry");
  foreach(var button in new[]{russian,english}){bool selected=(button==english)==NativeText.English;button.BackColor=selected?Color.FromArgb(185,171,130):Color.FromArgb(17,17,17);button.ForeColor=selected?Color.Black:Color.Gainsboro;button.FlatAppearance.MouseOverBackColor=selected?Color.FromArgb(212,198,156):Color.FromArgb(33,33,30);}
  ProgressText();
 }
 void ProgressText(){if(failure!=null){phase.Text=L("Не удалось загрузить пакет. Проверьте соединение и повторите попытку.","Download failed. Check your connection and retry.");details.Text=failure;return;}phase.Text=busy?L("Загрузка и проверка пакета…","Downloading and verifying the package…"):L("Готово к загрузке","Ready to download");details.Text=busy?ByteSize(received)+" / "+ByteSize(manifest.size)+" · "+L("часть ","part ")+(partIndex+1)+" / "+manifest.parts.Length:L("Размер пакета: ","Package size: ")+ByteSize(manifest.size);progress.Value=(int)Math.Min(100,received*100/manifest.size);if(busy){details.Text+=" · "+progress.Value+"% · "+L("прошло ","elapsed ")+elapsed.Elapsed.ToString(@"mm\:ss");if(received>0&&elapsed.Elapsed.TotalSeconds>5){double seconds=Math.Min(86400,elapsed.Elapsed.TotalSeconds*(manifest.size-received)/received);details.Text+=" · "+L("осталось ≈ ","remaining ≈ ")+TimeSpan.FromSeconds(seconds).ToString(@"mm\:ss");}}progress.Invalidate();}
 protected override void Dispose(bool disposing){if(disposing)displayClock.Dispose();base.Dispose(disposing);}
 async Task StartDownload(){
  if(busy)return;busy=true;progress.Visible=true;elapsed.Restart();failure=null;received=0;partIndex=0;install.Enabled=false;cleanup.Enabled=false;cancellation=new CancellationTokenSource();Render();var updateClock=Stopwatch.StartNew();
  try {var package=await Task.Run(()=>DownloadSetup.Download(manifest,cancellation.Token,delegate(long bytes,int index){if(updateClock.ElapsedMilliseconds<120&&bytes!=manifest.size)return;updateClock.Restart();if(!IsDisposed)BeginInvoke((Action)delegate{received=bytes;partIndex=index;ProgressText();});}));cancellation.Token.ThrowIfCancellationRequested();phase.Text=L("Пакет проверен. Открываем установщик…","Package verified. Opening setup…");
   var setup=Process.Start(new ProcessStartInfo(package){UseShellExecute=true});if(setup==null)throw new IOException("Setup did not start.");Hide();await Task.Run(()=>setup.WaitForExit());if(cleanup.Checked)try{File.Delete(package);}catch{}busy=false;Close();
  }catch(OperationCanceledException){failure=L("Загрузка остановлена. Проверенные части сохранены для продолжения.","Download stopped. Verified parts are kept so you can resume.");}
  catch(Exception error){failure=error.Message;}
  finally{elapsed.Stop();busy=false;install.Enabled=true;cleanup.Enabled=true;if(!IsDisposed){Show();Render();if(closeRequested)Close();}cancellation.Dispose();}
 }
}
