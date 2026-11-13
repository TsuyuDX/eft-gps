using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// Возобновление по блокам 16 МБ. Признаки завершения ускоряют повторную загрузку,
// но никогда не заменяют SHA-256 всего файла и каждой части перед запуском.
public sealed class SetupCheckpoint {public int format; public string identity; public bool[] complete;}
public static class SetupTransfer {
 public const int BlockSize=16*1024*1024;
 sealed class Block {public int part;public long start,length,offset;}
 static void Safe(string p){if((File.Exists(p)||Directory.Exists(p))&&(File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0)throw new IOException("Папка загрузки содержит перенаправление. Выберите обычную локальную папку.");}
 static void Save(string path,SetupCheckpoint state){string tmp=path+"."+Guid.NewGuid().ToString("N")+".tmp";try{File.WriteAllText(tmp,new JavaScriptSerializer().Serialize(state),new UTF8Encoding(false));if(File.Exists(path))File.Replace(tmp,path,null);else File.Move(tmp,path);}finally{if(File.Exists(tmp))File.Delete(tmp);}}
 static HttpWebRequest Request(DownloadManifest m,int part,long start,long length){var r=(HttpWebRequest)WebRequest.Create("https://github.com/TsuyuDX/eft-gps/releases/download/v"+m.version+"/"+Uri.EscapeDataString(m.parts[part].name));r.UserAgent="EFTGPS-Installer/"+m.version;r.Timeout=15000;r.ReadWriteTimeout=15000;r.AddRange(start,start+length-1);return r;}
 static bool Transient(Exception error){var w=error as WebException;if(w!=null){var response=w.Response as HttpWebResponse;if(response!=null)return (int)response.StatusCode>=500||(int)response.StatusCode==429;return w.Status==WebExceptionStatus.Timeout||w.Status==WebExceptionStatus.ConnectFailure||w.Status==WebExceptionStatus.NameResolutionFailure||w.Status==WebExceptionStatus.ReceiveFailure||w.Status==WebExceptionStatus.ConnectionClosed||w.Status==WebExceptionStatus.ProxyNameResolutionFailure;}return error is EndOfStreamException;}
 // Один проход чтения: хеши частей и всего EXE считаются вместе. Проверка отменяется.
 static bool Verify(string file,DownloadManifest m,CancellationToken token,Action<string,long,long> status,Action<int> badPart){
  if(!File.Exists(file)||new FileInfo(file).Length!=m.size)return false;
  using(var stream=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.Read,256*1024,FileOptions.SequentialScan))using(var whole=SHA256.Create()){
   var buffer=new byte[256*1024];long done=0;var clock=System.Diagnostics.Stopwatch.StartNew();
   for(int i=0;i<m.parts.Length;i++)using(var part=SHA256.Create()){
    long left=m.parts[i].size;while(left>0){token.ThrowIfCancellationRequested();int n=stream.Read(buffer,0,(int)Math.Min(buffer.Length,left));if(n==0)return false;whole.TransformBlock(buffer,0,n,buffer,0);part.TransformBlock(buffer,0,n,buffer,0);done+=n;left-=n;if(status!=null&&clock.ElapsedMilliseconds>=100){status("verify",done,m.size);clock.Restart();}}
    part.TransformFinalBlock(new byte[0],0,0);if(DownloadSetup.Hex(part.Hash)!=m.parts[i].sha256){if(badPart!=null)badPart(i);return false;}
   }whole.TransformFinalBlock(new byte[0],0,0);if(status!=null)status("verify",done,m.size);return DownloadSetup.Hex(whole.Hash)==m.sha256;
  }
 }
 public static string Run(DownloadManifest m,string cache,CancellationToken token,Action<long,int> progress,Action<string,long,long> status=null,Func<int,long,long,HttpWebRequest> factory=null){
  DownloadSetup.Validate(m);cache=Path.GetFullPath(cache);Safe(Path.GetDirectoryName(cache));Directory.CreateDirectory(cache);Safe(cache);string file=Path.Combine(cache,m.output),ledger=file+".resume.json",lockFile=file+".lock";Safe(file);Safe(ledger);Safe(lockFile);
  FileStream lease;try{lease=new FileStream(lockFile,FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None);}catch(IOException){throw new IOException("Этот пакет уже загружается в другом окне. Закройте лишний установщик.");}
  using(lease){token.ThrowIfCancellationRequested();if(status!=null)status("prepare",0,m.size);
   var blocks=new List<Block>();long offset=0;for(int i=0;i<m.parts.Length;i++){for(long start=0;start<m.parts[i].size;start+=BlockSize)blocks.Add(new Block{part=i,start=start,length=Math.Min(BlockSize,m.parts[i].size-start),offset=offset+start});offset+=m.parts[i].size;}
   var state=new SetupCheckpoint{format=1,identity=m.sha256,complete=new bool[blocks.Count]};
   try{if(new FileInfo(ledger).Length<128*1024){var old=new JavaScriptSerializer().Deserialize<SetupCheckpoint>(File.ReadAllText(ledger));if(old.format==1&&old.identity==m.sha256&&old.complete.Length==blocks.Count)state=old;}}catch(IOException){}catch(ArgumentException){}catch(InvalidOperationException){}catch(NullReferenceException){}
   long length=File.Exists(file)?new FileInfo(file).Length:0;
   // Совместимость с ранее сохранёнными установщиками без журнала блоков.
   if(!File.Exists(ledger)&&length==m.size&&Verify(file,m,token,status,null)){if(progress!=null)progress(m.size,m.parts.Length-1);return file;}
   long done=0;for(int i=0;i<blocks.Count;i++){if(blocks[i].offset+blocks[i].length>length)state.complete[i]=false;if(state.complete[i])done+=blocks[i].length;}
   var drive=new DriveInfo(Path.GetPathRoot(cache));if(drive.IsReady&&drive.AvailableFreeSpace<Math.Max(0,m.size-length)+64L*1024*1024)throw new IOException("Недостаточно места на диске для загрузки установщика.");
   // Нет предварительной записи гигабайтов нулей: файл растёт по мере загрузки.
   using(var init=new FileStream(file,FileMode.OpenOrCreate,FileAccess.Write,FileShare.ReadWrite)){if(length>m.size)init.SetLength(m.size);}
   Save(ledger,state);var gate=new object();long[] received=new long[blocks.Count];for(int i=0;i<blocks.Count;i++)if(state.complete[i])received[i]=blocks[i].length;
   Action<int,long> report=delegate(int index,long value){lock(gate){received[index]=value;long total=0;foreach(long x in received)total+=x;if(progress!=null)progress(total,blocks[index].part);}};
   if(progress!=null)progress(done,0);if(status!=null)status("download",done,m.size);
   int next=-1;
   var callerToken=token;using(var stop=CancellationTokenSource.CreateLinkedTokenSource(token)){token=stop.Token;
   try{Parallel.For(0,4,new ParallelOptions{MaxDegreeOfParallelism=4,CancellationToken=token},delegate(int worker){
    try{var buffer=new byte[256*1024];int index;
    while((index=Interlocked.Increment(ref next))<blocks.Count){token.ThrowIfCancellationRequested();if(state.complete[index])continue;var block=blocks[index];
     for(int attempt=0;;attempt++){
      token.ThrowIfCancellationRequested();var request=factory==null?Request(m,block.part,block.start,block.length):factory(block.part,block.start,block.length);
      using(token.Register(delegate{request.Abort();}))try{
       using(var response=(HttpWebResponse)request.GetResponse())using(var input=response.GetResponseStream())using(var target=new FileStream(file,FileMode.Open,FileAccess.Write,FileShare.ReadWrite,256*1024)){
        if(factory==null&&(response.ResponseUri.Scheme!="https"||(response.ResponseUri.Host!="github.com"&&response.ResponseUri.Host!="release-assets.githubusercontent.com")))throw new IOException("Недопустимый адрес загрузки.");
        string expected="bytes "+block.start+"-"+(block.start+block.length-1)+"/"+m.parts[block.part].size;
        bool entire=block.start==0&&block.length==m.parts[block.part].size;
        if(response.StatusCode!=HttpStatusCode.PartialContent&&!(entire&&response.StatusCode==HttpStatusCode.OK))throw new IOException("Сервер не поддерживает продолжение загрузки. Повторите попытку позже.");
        if(response.StatusCode==HttpStatusCode.PartialContent&&response.Headers["Content-Range"]!=expected)throw new IOException("Сервер вернул неверный диапазон файла.");
        if(response.ContentLength>=0&&response.ContentLength!=block.length)throw new IOException("Сервер вернул неверный размер файла.");
        target.Position=block.offset;long written=0;while(written<block.length){token.ThrowIfCancellationRequested();int n=input.Read(buffer,0,(int)Math.Min(buffer.Length,block.length-written));if(n==0)throw new EndOfStreamException("Соединение прервано до завершения загрузки.");target.Write(buffer,0,n);written+=n;report(index,written);}target.Flush();
       }
       lock(gate){state.complete[index]=true;Save(ledger,state);}break;
      }catch(Exception error){if(token.IsCancellationRequested)throw new OperationCanceledException();bool retry=attempt<2&&Transient(error);var web=error as WebException;if(web!=null&&web.Response!=null)web.Response.Close();if(!retry)throw;report(index,0);if(status!=null)status("retry",0,m.size);if(token.WaitHandle.WaitOne(750*(attempt+1)))throw new OperationCanceledException();}
     }
    }
    }catch{stop.Cancel();throw;}
   });}catch(AggregateException e){if(callerToken.IsCancellationRequested)throw new OperationCanceledException();foreach(var inner in e.Flatten().InnerExceptions)if(!(inner is OperationCanceledException))throw inner;throw new OperationCanceledException();}
   }token=callerToken;
   token.ThrowIfCancellationRequested();int invalid=-1;if(!Verify(file,m,token,status,delegate(int i){invalid=i;})){
    for(int i=0;i<blocks.Count;i++)if(invalid<0||blocks[i].part==invalid)state.complete[i]=false;Save(ledger,state);throw new IOException("Контрольная сумма не совпадает. Нажмите «Повторить»: повреждённая часть будет загружена заново.");}
   if(status!=null)status("ready",m.size,m.size);return file;
  }
 }
}
