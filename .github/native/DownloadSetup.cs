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
 // Сетевая передача вынесена отдельно: её можно тестировать без запуска окон.
 public static string DownloadTo(DownloadManifest manifest,string cache,CancellationToken token,Action<long,int> progress){return SetupTransfer.Run(manifest,cache,token,progress);}
 public static string DownloadWithStatus(DownloadManifest manifest,CancellationToken token,Action<long,int> progress,Action<string,long,long> status){return SetupTransfer.Run(manifest,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"EFTGPS-Installer",manifest.version),token,progress,status);}

 static void SelfTest(){
  var bytes=Encoding.UTF8.GetBytes("EFT GPS package fixture");string hash;using(var sha=SHA256.Create())hash=Hex(sha.ComputeHash(bytes));using(var input=new MemoryStream(bytes))using(var output=new MemoryStream()){CopyPart(input,output,bytes.Length,hash,CancellationToken.None,null);if(Encoding.UTF8.GetString(output.ToArray())!="EFT GPS package fixture")throw new Exception("Copy failed");}
  bool corrupt=false;try{CopyPart(new MemoryStream(bytes),Stream.Null,bytes.Length,new string('0',64),CancellationToken.None,null);}catch(IOException){corrupt=true;}if(!corrupt)throw new Exception("Corruption was accepted");
  bool truncated=false;try{CopyPart(new MemoryStream(bytes),Stream.Null,bytes.Length+1,hash,CancellationToken.None,null);}catch(IOException){truncated=true;}if(!truncated)throw new Exception("Truncation was accepted");
  var cancellation=new CancellationTokenSource();cancellation.Cancel();bool cancelled=false;try{CopyPart(new MemoryStream(bytes),Stream.Null,bytes.Length,hash,cancellation.Token,null);}catch(OperationCanceledException){cancelled=true;}if(!cancelled)throw new Exception("Cancellation was ignored");ReadManifest();
  var fixture=new DownloadManifest{format=1,version="0.0.0",output="EFTGPS-Test-Setup.exe",size=bytes.Length,sha256=hash,parts=new[]{new DownloadPart{name="EFTGPS-Test-Setup.exe.part01",size=bytes.Length,sha256=hash}}};
  string cache=Path.Combine(Path.GetTempPath(),"eftgps-download-test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(cache);string cached=Path.Combine(cache,fixture.output);
  try{File.WriteAllBytes(cached,bytes);long loaded=0;string restored=DownloadTo(fixture,cache,CancellationToken.None,delegate(long value,int index){loaded=value;});if(restored!=cached||loaded!=bytes.Length||File.ReadAllBytes(cached).Length!=bytes.Length)throw new Exception("Verified cache resume failed");fixture.output="../EFTGPS-Test-Setup.exe";bool rejected=false;try{Validate(fixture);}catch(IOException){rejected=true;}if(!rejected)throw new Exception("Unsafe file name was accepted");}finally{File.Delete(cached);File.Delete(cached+".lock");File.Delete(cached+".resume.json");Directory.Delete(cache);}
 }
 [STAThread] public static void Main(string[] args){try{AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling",false);AppContext.SetSwitch("Switch.System.IO.BlockLongPaths",false);ServicePointManager.SecurityProtocol|=SecurityProtocolType.Tls12;ServicePointManager.DefaultConnectionLimit=6;if(args.Length==1&&args[0]=="--self-test"){SelfTest();Environment.Exit(0);return;}NativeText.English=CultureInfo.CurrentUICulture.TwoLetterISOLanguageName!="ru";Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new DownloadWindow(ReadManifest()));}catch(Exception error){if(args.Length>0){Console.Error.WriteLine(error.GetType().Name+": "+error.Message);Environment.Exit(1);return;}MessageBox.Show(error.Message,NativeText.Brand,MessageBoxButtons.OK,MessageBoxIcon.Error);}}
}
class DownloadWindow : DarkWindow {
 readonly DownloadManifest manifest; readonly Label title,subtitle,phase,details; readonly InstallProgress progress=new InstallProgress();readonly CheckBox cleanup=new DarkCheckBox();readonly CheckBox diagnosticConsent=new DarkCheckBox(); readonly Button install,cancel,russian,english; readonly Stopwatch elapsed=new Stopwatch(); readonly System.Windows.Forms.Timer displayClock=new System.Windows.Forms.Timer {Interval=500};
 CancellationTokenSource cancellation;bool busy,closeRequested;long received;int partIndex;string failure;string transferPhase="prepare";long checkedBytes,checkTotal;readonly Stopwatch transferClock=new Stopwatch();long transferStart=-1;
 string L(string ru,string en){string value=NativeText.T(ru);return NativeText.English&&value==ru?en:value;}
 string ByteSize(long bytes){return (bytes/1000000000.0).ToString("0.00",CultureInfo.GetCultureInfo(NativeText.English?"en-US":"ru-RU"))+" GB";}
 public DownloadWindow(DownloadManifest value){
  manifest=value;ClientSize=new Size(820,580);
  using(var resource=Assembly.GetExecutingAssembly().GetManifestResourceStream("installer-logo.png"))using(var image=Image.FromStream(resource))Controls.Add(new PictureBox{Image=new Bitmap(image),SizeMode=PictureBoxSizeMode.Zoom,Bounds=new Rectangle(28,24,62,62)});
  TextAt(NativeText.Brand,106,22,520,40,22,ForeColor);TextAt("Windows 10 / 11 · x64  /  "+manifest.version,108,67,530,24,9,Color.FromArgb(157,157,147));
  russian=ButtonAt("RU",650,28,66,false);english=ButtonAt("EN",724,28,68,false);russian.Height=english.Height=32;russian.AccessibleName="Русский";english.AccessibleName="English";
  russian.Click+=delegate{NativeText.English=false;Render();};english.Click+=delegate{NativeText.English=true;Render();};
  title=TextAt("",28,142,764,43,20,ForeColor);subtitle=TextAt("",28,199,764,72,10,Color.FromArgb(157,157,147));phase=TextAt("",28,294,764,48,11,ForeColor);details=TextAt("",28,338,764,44,10,Color.FromArgb(185,171,130));progress.SetBounds(28,386,764,4);progress.Visible=false;
  cleanup.SetBounds(28,409,764,28);cleanup.Checked=true;diagnosticConsent.SetBounds(28,443,764,44);diagnosticConsent.Checked=false;cancel=ButtonAt("",448,512,132,false);install=ButtonAt("",592,512,200,true);
  cancel.Click+=delegate{if(busy)cancellation.Cancel();else Close();};install.Click+=async delegate{await StartDownload();};
  Controls.AddRange(new Control[]{russian,english,progress,cleanup,diagnosticConsent,cancel,install});russian.BringToFront();english.BringToFront();displayClock.Tick+=delegate{if(busy)ProgressText();};displayClock.Start();AcceptButton=install;CancelButton=cancel;
  FormClosing+=delegate(object sender,FormClosingEventArgs e){if(busy){closeRequested=true;e.Cancel=true;cancellation.Cancel();}};Render();
 }
 void Render(){
  Text=NativeText.Brand+" "+manifest.version+L(" · Загрузка"," · Download");title.Text=L("Один файл — обычная установка.","One download. Familiar setup.");subtitle.Text=L("Скачаем файлы и откроем установку.\nПосле установки карты и справочник доступны без интернета.","We will download the files and open setup.\nAfter installation, maps and reference data are available offline.");
  diagnosticConsent.Text=L("Сохранить на этом ПК версию, этап, время и код ошибки — без личных данных. Добровольно; отправка отключена.","Save version, stage, duration and error code on this PC, without personal data. Optional; upload is off.");
  cleanup.Text=L("Удалить временный пакет после закрытия установщика","Remove the temporary package after setup closes");cancel.Text=busy?L("Остановить","Stop"):L("Закрыть","Close");install.Text=failure==null?L("Скачать и установить","Download and install"):L("Повторить","Retry");
  foreach(var button in new[]{russian,english}){bool selected=(button==english)==NativeText.English;button.BackColor=selected?Color.FromArgb(185,171,130):Color.FromArgb(17,17,17);button.ForeColor=selected?Color.Black:Color.Gainsboro;button.FlatAppearance.MouseOverBackColor=selected?Color.FromArgb(212,198,156):Color.FromArgb(33,33,30);}
  ProgressText();
 }
 // Этапы проверки и ожидания соединения видны так же, как переданные байты.
 void ProgressText(){
  if(failure!=null){phase.Text=L("Не удалось завершить загрузку. Нажмите «Повторить».","Download could not finish. Click Retry.");details.Text=failure;details.AutoEllipsis=true;return;}
  bool verifying=transferPhase=="verify";phase.Text=!busy?L("Готово к загрузке","Ready to download"):verifying?L("Проверяем целостность установщика…","Verifying installer integrity…"):transferPhase=="prepare"?L("Проверяем папку и свободное место…","Checking the folder and free space…"):transferPhase=="retry"?L("Соединение прервано. Повторяем загрузку…","Connection interrupted. Retrying…"):received==0?L("Подключаемся к GitHub…","Connecting to GitHub…"):L("Загружаем установщик…","Downloading the installer…");
  long current=verifying?checkedBytes:received;long total=verifying?checkTotal:manifest.size;
  progress.Value=(int)Math.Min(100,verifying?85+current*15/Math.Max(1,total):received*85/manifest.size);
  details.Text=busy?ByteSize(current)+" / "+ByteSize(total)+" · "+progress.Value+"% · "+L("прошло ","elapsed ")+elapsed.Elapsed.ToString(@"hh\:mm\:ss"):L("Размер пакета: ","Package size: ")+ByteSize(manifest.size);
  if(busy&&!verifying&&transferClock.Elapsed.TotalSeconds>1&&received>transferStart&&transferStart>=0){double speed=(received-transferStart)/transferClock.Elapsed.TotalSeconds;details.Text+=" · "+(speed/1048576).ToString("0.0")+" MB/s";if(speed>0)details.Text+=" · "+L("осталось ≈ ","remaining ≈ ")+TimeSpan.FromSeconds(Math.Min(86400,(manifest.size-received)/speed)).ToString(@"hh\:mm\:ss");}
  progress.Invalidate();
 }
 string Explain(Exception error){var network=error as WebException;if(network!=null){if(network.Status==WebExceptionStatus.Timeout)return L("Сервер не ответил вовремя. Проверьте соединение и нажмите «Повторить».","The server timed out. Check your connection and click Retry.");var response=network.Response as HttpWebResponse;if(response!=null)return "GitHub: HTTP "+(int)response.StatusCode+". "+L("Загруженные блоки сохранены; повторите попытку позже.","Downloaded blocks are kept; try again later.");return L("Не удалось подключиться к GitHub. Проверьте интернет и настройки прокси.","Could not connect to GitHub. Check your internet connection and proxy settings.");}if(error is UnauthorizedAccessException)return L("Нет доступа к папке загрузки. Закройте другие установщики и проверьте права на папку.","Cannot access the download folder. Close other setup windows and check folder permissions.");return NativeText.T(error.Message);}

 protected override void Dispose(bool disposing){if(disposing)displayClock.Dispose();base.Dispose(disposing);}
 async Task StartDownload(){
  if(busy)return;busy=true;progress.Visible=true;elapsed.Restart();failure=null;received=0;partIndex=0;transferPhase="prepare";checkedBytes=0;checkTotal=manifest.size;transferStart=-1;transferClock.Reset();install.Enabled=false;cleanup.Enabled=false;cancellation=new CancellationTokenSource();Render();var updateClock=Stopwatch.StartNew();
  try {var package=await Task.Run(()=>DownloadSetup.DownloadWithStatus(manifest,cancellation.Token,delegate(long bytes,int index){if(updateClock.ElapsedMilliseconds<120&&bytes!=manifest.size)return;updateClock.Restart();if(!IsDisposed)BeginInvoke((Action)delegate{received=bytes;partIndex=index;if(transferPhase=="retry")transferPhase="download";if(transferStart<0){transferStart=bytes;transferClock.Restart();}ProgressText();});},delegate(string stage,long value,long total){if(!IsDisposed)BeginInvoke((Action)delegate{transferPhase=stage;checkedBytes=value;checkTotal=total;ProgressText();});}));cancellation.Token.ThrowIfCancellationRequested();phase.Text=L("Пакет проверен. Открываем установщик…","Package verified. Opening setup…");
   var setup=Process.Start(new ProcessStartInfo(package){UseShellExecute=true});if(setup==null)throw new IOException("Setup did not start.");Hide();await Task.Run(()=>setup.WaitForExit());if(setup.ExitCode!=0)throw new IOException(L("Установка не завершена. Пакет сохранён — можно повторить установку без новой загрузки.","Setup did not finish. The package is kept so you can retry without downloading again."));if(cleanup.Checked)try{File.Delete(package);File.Delete(package+".resume.json");File.Delete(package+".lock");}catch{}busy=false;Close();
  }catch(OperationCanceledException){failure=L("Загрузка остановлена. Загруженные блоки сохранены для продолжения.","Download stopped. Downloaded blocks are kept so you can resume.");}
  catch(Exception error){failure=Explain(error);if(diagnosticConsent.Checked)try{string dir=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"EFTGPS-Installer",manifest.version);Directory.CreateDirectory(dir);File.WriteAllText(Path.Combine(dir,"download-error.txt"),new JavaScriptSerializer().Serialize(new {format=1,version=manifest.version,stage=transferPhase,code=error.GetType().Name,elapsedSeconds=(int)elapsed.Elapsed.TotalSeconds,uploadConfigured=false}));}catch{}}
  finally{elapsed.Stop();busy=false;install.Enabled=true;cleanup.Enabled=true;if(!IsDisposed){Show();Render();if(closeRequested)Close();}cancellation.Dispose();}
 }
}
