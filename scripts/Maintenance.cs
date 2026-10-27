using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Net;
using System.Drawing;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Runtime.InteropServices;

public class ReleaseFile { public string path; public string sha256; public long size; }
public class ReleaseInfo { public int format; public string app; public string version; public ReleaseFile[] files; }
public static class PackageInstaller {
    static string Extended(string value) {
        if (value.StartsWith(@"\\?\")) return value;
        return value.StartsWith(@"\\") ? @"\\?\UNC\" + value.Substring(2) : @"\\?\" + value;
    }
    public static string Hash(string file) { using (var sha = SHA256.Create()) using (var stream = File.OpenRead(file)) return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant(); }
    static string SafePath(string root, string relative) {
        if (String.IsNullOrWhiteSpace(relative) || relative.IndexOf('\\') >= 0 || relative.IndexOf(':') >= 0 || relative.StartsWith("/")) throw new IOException("Некорректный путь в пакете");
        foreach (string segment in relative.Split('/')) if (segment == "." || segment == ".." || segment.Length == 0 || segment.EndsWith(".") || segment.EndsWith(" ")) throw new IOException("Некорректный путь в пакете");
        string first = relative.Split('/')[0].ToLowerInvariant();
        if (first == "userdata" || first == "work" || first.StartsWith("snapshot-backup") || first == "update-staging") throw new IOException("Пакет пытается изменить пользовательские файлы");
        string full = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
        string prefix = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new IOException("Путь выходит за папку приложения");
        string current = Path.GetDirectoryName(full);
        while (current != null) {
            if (Directory.Exists(Extended(current)) && (File.GetAttributes(Extended(current)) & FileAttributes.ReparsePoint) != 0) throw new IOException("Папка установки содержит перенаправление");
            current = Path.GetDirectoryName(current);
        }
        if (File.Exists(Extended(full)) && (File.GetAttributes(Extended(full)) & FileAttributes.ReparsePoint) != 0) throw new IOException("Файл установки является ссылкой");
        return Extended(full);
    }
    public static ReleaseInfo Stage(string zip, string staged, Action<string> progress) {
        Directory.CreateDirectory(staged);
        using (var archive = ZipFile.OpenRead(zip)) {
            var entry = archive.GetEntry("release.json");
            if (entry == null || entry.Length > 16 * 1024 * 1024) throw new IOException("Это не пакет EFT GPS");
            ReleaseInfo release;
            using (var reader = new StreamReader(entry.Open())) release = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 }.Deserialize<ReleaseInfo>(reader.ReadToEnd());
            if (release == null || release.format != 1 || release.app != "TarkovOffline" || release.files == null || release.files.Length == 0) throw new IOException("Неподдерживаемый пакет");
            Version version;
            if (!Version.TryParse(release.version, out version)) throw new IOException("В пакете нет версии");
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var indexed = new Dictionary<string, ZipArchiveEntry>(StringComparer.OrdinalIgnoreCase);
            long total = 0;
            foreach (var item in archive.Entries) {
                if (!indexed.TryAddCompat(item.FullName, item)) throw new IOException("Повторяющийся путь в пакете");
                if (item.FullName != "release.json") SafePath(staged, item.FullName);
                if (((item.ExternalAttributes >> 16) & 0xF000) == 0xA000) throw new IOException("Ссылки в пакете запрещены");
            }
            if (indexed.Count != release.files.Length + 1) throw new IOException("Состав пакета не совпадает с описанием");
            int count = 0;
            foreach (var file in release.files) {
                if (!names.Add(file.path) || file.sha256 == null || file.sha256.Length != 64 || file.size < 0) throw new IOException("Повреждён список файлов");
                string destination = SafePath(staged, file.path);
                ZipArchiveEntry item;
                if (!indexed.TryGetValue(file.path, out item) || item.Length != file.size) throw new IOException("В пакете отсутствует файл: " + file.path);
                total += item.Length;
                if (total > 8L * 1024 * 1024 * 1024) throw new IOException("Пакет слишком большой");
                Directory.CreateDirectory(Path.GetDirectoryName(destination));
                using (var source = item.Open()) using (var target = File.Create(destination)) source.CopyTo(target);
                if (Hash(destination) != file.sha256) throw new IOException("Не прошла проверка файла: " + file.path);
                if (++count % 300 == 0) progress("Проверка пакета: " + count + " / " + release.files.Length);
            }
            if (!names.Contains("Tarkov Offline.exe") || !names.Contains("server.mjs") || !names.Contains("public/index.html")) throw new IOException("В пакете нет основных файлов приложения");
            File.WriteAllText(Path.Combine(staged, "release.json"), new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 }.Serialize(release), Encoding.UTF8);
            return release;
        }
    }
    static bool TryAddCompat<T>(this Dictionary<string,T> map, string key, T value) { if (map.ContainsKey(key)) return false; map.Add(key, value); return true; }
    public static string Install(string target, string staged, ReleaseInfo release, Action<string> progress) {
        target = Path.GetFullPath(target);
        if (Directory.Exists(target) && Directory.GetFileSystemEntries(target).Length > 0 && !File.Exists(Path.Combine(target, "Tarkov Offline.exe"))) throw new IOException("Выберите пустую папку или папку установленного EFT GPS");
        Directory.CreateDirectory(target);
        string backup = Path.Combine(target, "work", "install-backup-" + DateTime.Now.ToString("yyyyMMdd-HHmmss-fff"));
        string work = Path.Combine(target, "work");
        if (Directory.Exists(work) && (File.GetAttributes(work) & FileAttributes.ReparsePoint) != 0) throw new IOException("Служебная папка является перенаправлением");
        var changed = new List<string>();
        var existed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try {
            foreach (var file in release.files) {
                string destination = SafePath(target, file.path);
                if (File.Exists(destination) && Hash(destination) == file.sha256) continue;
                if (File.Exists(destination)) {
                    string copy = SafePath(backup, file.path);
                    Directory.CreateDirectory(Path.GetDirectoryName(copy));
                    File.Copy(destination, copy);
                    existed.Add(file.path);
                }
                Directory.CreateDirectory(Path.GetDirectoryName(destination));
                changed.Add(file.path);
                string next = SafePath(target, file.path + ".install-new");
                File.Copy(SafePath(staged, file.path), next, true);
                if (File.Exists(destination)) File.Replace(next, destination, null); else File.Move(next, destination);
                if (changed.Count % 100 == 0) progress("Установка: " + changed.Count + " файлов");
            }
            File.WriteAllText(Path.Combine(target, "release.json"), new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 }.Serialize(release), Encoding.UTF8);
            return backup;
        } catch {
            var failures = new List<string>();
            changed.Reverse();
            foreach (string relative in changed) {
                try {
                    string destination = SafePath(target, relative);
                    if (existed.Contains(relative)) File.Copy(SafePath(backup, relative), destination, true);
                    else if (File.Exists(destination)) File.Delete(destination);
                    if (File.Exists(destination + ".install-new")) File.Delete(destination + ".install-new");
                } catch { failures.Add(relative); }
            }
            if (failures.Count > 0) throw new IOException("Не удалось полностью восстановить файлы. Резервная копия: " + backup);
            throw;
        }
    }
}

class DarkWindow : Form {
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);
    public DarkWindow() {
        BackColor = Color.Black; ForeColor = Color.FromArgb(232,232,226);
        Font = new Font("Segoe UI", 10); AutoScaleMode = AutoScaleMode.Dpi;
        StartPosition = FormStartPosition.CenterScreen;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        MaximizeBox = false; FormBorderStyle = FormBorderStyle.FixedSingle;
    }
    protected override void OnShown(EventArgs e) {base.OnShown(e);NativeText.Apply(this);}
    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        try { int dark=1, black=0, white=0x00E2E8E8;
            DwmSetWindowAttribute(Handle,20,ref dark,4); DwmSetWindowAttribute(Handle,35,ref black,4);
            DwmSetWindowAttribute(Handle,36,ref white,4); DwmSetWindowAttribute(Handle,34,ref black,4);
        } catch {}
    }
    public static Button ButtonAt(string text, int x, int y, int width, bool primary) {
        var button = new Button { Text=text, Bounds=new Rectangle(x,y,width,40), FlatStyle=FlatStyle.Flat,
            BackColor=primary ? Color.FromArgb(185,171,130) : Color.FromArgb(17,17,17),
            ForeColor=primary ? Color.Black : Color.Gainsboro, Cursor=Cursors.Hand };
        button.FlatAppearance.BorderColor=Color.FromArgb(67,66,59); button.FlatAppearance.BorderSize=1;
        button.FlatAppearance.MouseOverBackColor=primary ? Color.FromArgb(212,198,156) : Color.FromArgb(33,33,30);
        return button;
    }
    public Label TextAt(string text, int x, int y, int width, int height, float size, Color color) {
        var label=new Label { Text=text, Bounds=new Rectangle(x,y,width,height), Font=new Font("Segoe UI",size), ForeColor=color };
        Controls.Add(label); return label;
    }
}
class FolderChoice {
    public string Path, Name;
    public FolderChoice(string path,string name) {Path=path;Name=name;}
}
// Owner-drawn folder list: keyboard navigation and a dark scrollbar, without shell chrome.
class FolderList : Control {
    public List<FolderChoice> Items=new List<FolderChoice>();
    public Action SelectionChanged, OpenSelected;
    public int Selected=-1;
    int first; bool dragging; int dragY, dragFirst;
    const int row=38;
    int VisibleRows {get {return Math.Max(1,Height/row);}}
    int MaxFirst {get {return Math.Max(0,Items.Count-VisibleRows);}}
    Rectangle Thumb {get {int h=Math.Min(Height,Math.Max(30,Height*VisibleRows/Math.Max(VisibleRows,Items.Count)));return new Rectangle(Width-8,first*(Height-h)/Math.Max(1,MaxFirst),3,h);}}
    public FolderList() {DoubleBuffered=true;TabStop=true;AccessibleName="Папки";AccessibleRole=AccessibleRole.List;BackColor=Color.FromArgb(13,13,12);}
    public void SetItems(List<FolderChoice> items) {Items=items;Selected=-1;first=0;Invalidate();}
    void Scroll(int value) {first=Math.Max(0,Math.Min(MaxFirst,value));Invalidate();}
    void SelectRow(int value) {if(Items.Count==0) return;Selected=Math.Max(0,Math.Min(Items.Count-1,value));if(Selected<first) first=Selected;if(Selected>=first+VisibleRows) first=Selected-VisibleRows+1;Invalidate();if(SelectionChanged!=null) SelectionChanged();}
    protected override bool IsInputKey(Keys key) {return key==Keys.Up||key==Keys.Down||key==Keys.Home||key==Keys.End||key==Keys.PageUp||key==Keys.PageDown||base.IsInputKey(key);}
    protected override void OnKeyDown(KeyEventArgs e) {
        base.OnKeyDown(e);
        if(e.KeyCode==Keys.Down) SelectRow(Selected+1); else if(e.KeyCode==Keys.Up) SelectRow(Selected-1);
        else if(e.KeyCode==Keys.Home) SelectRow(0); else if(e.KeyCode==Keys.End) SelectRow(Items.Count-1);
        else if(e.KeyCode==Keys.PageDown) SelectRow(Selected+VisibleRows);else if(e.KeyCode==Keys.PageUp) SelectRow(Selected-VisibleRows);
        else if(e.KeyCode==Keys.Enter && Selected>=0 && OpenSelected!=null) {OpenSelected();e.Handled=true;}
    }
    protected override void OnMouseWheel(MouseEventArgs e) {base.OnMouseWheel(e);Scroll(first-e.Delta/120*3);}
    protected override void OnMouseDown(MouseEventArgs e) {
        base.OnMouseDown(e);Focus();
        if(e.X>=Width-16 && MaxFirst>0) {if(e.Y>=Thumb.Top && e.Y<=Thumb.Bottom) {dragging=true;dragY=e.Y;dragFirst=first;Capture=true;} else Scroll(first+(e.Y<Thumb.Top ? -VisibleRows : VisibleRows));return;}
        int index=first+e.Y/row;if(index<Items.Count) SelectRow(index);
    }
    protected override void OnMouseMove(MouseEventArgs e) {base.OnMouseMove(e);if(dragging) Scroll(dragFirst+(e.Y-dragY)*MaxFirst/Math.Max(1,Height-Thumb.Height));}
    protected override void OnMouseUp(MouseEventArgs e) {base.OnMouseUp(e);dragging=false;Capture=false;Invalidate();}
    protected override void OnMouseDoubleClick(MouseEventArgs e) {base.OnMouseDoubleClick(e);if(e.X<Width-16 && Selected>=0 && OpenSelected!=null) OpenSelected();}
    protected override void OnPaint(PaintEventArgs e) {
        e.Graphics.Clear(BackColor);
        for(int index=first;index<Math.Min(Items.Count,first+VisibleRows+1);index++) {
            int y=(index-first)*row;
            if(index==Selected) using(var brush=new SolidBrush(Color.FromArgb(47,45,36))) e.Graphics.FillRectangle(brush,0,y,Width-16,row);
            using(var brush=new SolidBrush(Color.FromArgb(185,171,130))) {e.Graphics.FillRectangle(brush,14,y+14,18,13);e.Graphics.FillRectangle(brush,14,y+11,8,4);}
            TextRenderer.DrawText(e.Graphics,Items[index].Name,Font,new Rectangle(46,y,Width-68,row),ForeColor,TextFormatFlags.Left|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);
        }
        if(MaxFirst>0) using(var brush=new SolidBrush(dragging ? Color.FromArgb(180,185,171,130) : Color.FromArgb(85,185,171,130))) e.Graphics.FillRectangle(brush,Thumb);
        if(Focused) ControlPaint.DrawFocusRectangle(e.Graphics,ClientRectangle,Color.FromArgb(85,85,78),BackColor);
    }
}
class DarkFolderPicker : DarkWindow {
    readonly TextBox address=new TextBox();
    readonly FolderList folders=new FolderList();
    readonly Label hint=new Label();
    readonly Stack<string> history=new Stack<string>();
    Button back,up,choose;
    string current="",selected;
    int request;
    public string SelectedPath {get;private set;}
    public DarkFolderPicker(string initial) {
        Text="EFT GPS · Выбор папки";ClientSize=new Size(840,590);MinimizeBox=false;StartPosition=FormStartPosition.CenterParent;
        TextAt("Куда установить приложение?",24,20,792,39,20,ForeColor);
        TextAt("Выберите папку или введите новый путь — создадим её во время установки.",24,67,792,28,10,Color.Silver);
        back=ButtonAt("←",24,108,44,false);back.AccessibleName="Назад";back.Click+=delegate {if(history.Count>0) Navigate(history.Pop(),false);};
        up=ButtonAt("↑",76,108,44,false);up.AccessibleName="На уровень выше";up.Click+=delegate {GoUp();};
        address.SetBounds(134,115,570,29);address.BackColor=Color.FromArgb(19,19,18);address.ForeColor=ForeColor;address.BorderStyle=BorderStyle.FixedSingle;address.AccessibleName="Путь к папке";
        address.KeyDown+=delegate(object sender,KeyEventArgs e) {if(e.KeyCode==Keys.Enter) {e.SuppressKeyPress=true;Navigate(address.Text,true);}};
        var go=ButtonAt("Перейти",716,108,100,false);go.Click+=delegate {Navigate(address.Text,true);};
        string[] names={"Этот компьютер","Рабочий стол","Документы","Моя папка","Папка программы"};
        string[] paths={"",Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),initial};
        for(int n=0;n<names.Length;n++) {string location=paths[n];var quick=ButtonAt(names[n],24,172+n*48,164,false);quick.Click+=delegate {Navigate(location,true);};Controls.Add(quick);}
        folders.SetBounds(208,172,608,302);folders.ForeColor=ForeColor;
        folders.SelectionChanged=delegate {if(folders.Selected>=0) {selected=folders.Items[folders.Selected].Path;choose.Enabled=true;hint.Text=NativeText.T("Выбрано: "+selected);}};
        folders.OpenSelected=delegate {if(folders.Selected>=0) Navigate(folders.Items[folders.Selected].Path,true);};
        hint.SetBounds(24,490,792,42);hint.ForeColor=Color.Silver;
        var cancel=ButtonAt("Отмена",488,536,132,false);cancel.DialogResult=DialogResult.Cancel;
        choose=ButtonAt("Выбрать папку",632,536,184,true);choose.Click+=delegate {
            try {string value=selected ?? address.Text;if(String.IsNullOrWhiteSpace(value)) throw new IOException("Выберите диск или папку.");SelectedPath=Normalize(value);DialogResult=DialogResult.OK;Close();}
            catch(Exception e) {hint.Text=NativeText.T(e.Message);}
        };
        address.TextChanged+=delegate {selected=null;};
        Controls.AddRange(new Control[]{back,up,address,go,folders,hint,cancel,choose});CancelButton=cancel;
        KeyPreview=true;KeyDown+=delegate(object sender,KeyEventArgs e) {if(e.Alt && e.KeyCode==Keys.Up) {GoUp();e.Handled=true;}else if(e.Alt && e.KeyCode==Keys.Left && history.Count>0) {Navigate(history.Pop(),false);e.Handled=true;}};
        Shown+=delegate {Navigate(initial,false);};
    }
    internal static string Normalize(string path) {
        string full=Path.GetFullPath(Environment.ExpandEnvironmentVariables(path.Trim()));
        foreach(string part in full.Substring(Path.GetPathRoot(full).Length).Split(Path.DirectorySeparatorChar)) {
            if(part.IndexOfAny(Path.GetInvalidFileNameChars())>=0 || part.EndsWith(" ") || part.EndsWith(".")) throw new IOException("В имени папки есть недопустимые символы.");
        }
        return full;
    }
    void GoUp() {if(current.Length==0) return;var parent=Directory.GetParent(current);Navigate(parent==null ? "" : parent.FullName,true);}
    async void Navigate(string path,bool remember) {
        int ticket=++request;
        try {
            string destination=path.Length==0 ? "" : Normalize(path);
            if(remember && current!=destination) history.Push(current);
            current=destination;selected=null;address.Text=destination;back.Enabled=history.Count>0;up.Enabled=destination.Length>0;
            choose.Enabled=false;folders.SetItems(new List<FolderChoice>());hint.Text=NativeText.T("Открываем папку…");
            var result=await Task.Run(()=> {
                var entries=new List<FolderChoice>();
                if(destination.Length==0) {foreach(var drive in DriveInfo.GetDrives()) entries.Add(new FolderChoice(drive.Name,"Диск "+drive.Name));}
                else if(Directory.Exists(destination)) {foreach(string directory in Directory.GetDirectories(destination)) entries.Add(new FolderChoice(directory,Path.GetFileName(directory)));entries.Sort((a,b)=>StringComparer.CurrentCultureIgnoreCase.Compare(a.Name,b.Name));}
                return entries;
            });
            if(IsDisposed || ticket!=request) return;
            folders.SetItems(result);choose.Enabled=destination.Length>0;
            hint.Text=NativeText.T(destination.Length==0 ? "Выберите диск для просмотра папок." : (!Directory.Exists(destination) ? "Новая папка будет создана при установке." : "Папок: "+result.Count+". Двойной щелчок — открыть; «Выбрать папку» — подтвердить."));
        } catch(Exception e) {if(!IsDisposed && ticket==request) {hint.Text=NativeText.T("Не удалось открыть папку: "+e.Message);choose.Enabled=false;}}
    }
}
class InstallConfirmation : DarkWindow {
    public InstallConfirmation(string heading, string message, string accept) {
        Text="EFT GPS · Подтверждение"; ClientSize=new Size(620,360); MinimizeBox=false;
        TextAt(heading,24,22,572,42,19,ForeColor);
        TextAt(message,24,78,572,206,10,Color.Silver);
        var cancel=ButtonAt("Назад",300,296,128,false); cancel.DialogResult=DialogResult.Cancel;
        var confirm=ButtonAt(accept,440,296,156,true); confirm.DialogResult=DialogResult.OK;
        Controls.AddRange(new Control[]{cancel,confirm}); AcceptButton=confirm; CancelButton=cancel;
        StartPosition=FormStartPosition.CenterParent;
    }
}
// Native text editing and copying, with a scrollbar painted in the app palette.
class DarkLog : Panel {
    class LogText : TextBox {
        public Action Changed;
        protected override void WndProc(ref Message m) { base.WndProc(ref m); if(Changed!=null && (m.Msg==0x20A || m.Msg==0x115 || m.Msg==0x101 || m.Msg==0xB7)) Changed(); }
    }
    class ScrollRail : Control {
        public DarkLog Owner; bool dragging; int dragStart, lineStart;
        public ScrollRail() { DoubleBuffered=true; Cursor=Cursors.Hand; AccessibleRole=AccessibleRole.ScrollBar; AccessibleName="Прокрутка журнала"; }
        Rectangle Thumb() { int total=Owner.Total,visible=Owner.VisibleLines; int height=Math.Min(Height,Math.Max(24,Height*visible/Math.Max(visible,total))); int top=Owner.First*(Height-height)/Math.Max(1,total-visible);return new Rectangle(6,top,3,height); }
        protected override void OnPaint(PaintEventArgs e) { e.Graphics.Clear(Color.FromArgb(14,14,13)); if(Owner.Total<=Owner.VisibleLines) return; using(var brush=new SolidBrush(dragging ? Color.FromArgb(180,185,171,130) : Color.FromArgb(85,185,171,130))) e.Graphics.FillRectangle(brush,Thumb()); }
        protected override void OnMouseDown(MouseEventArgs e) { base.OnMouseDown(e); if(e.Y>=Thumb().Top && e.Y<=Thumb().Bottom) { dragging=true;dragStart=e.Y;lineStart=Owner.First;Capture=true; } else Owner.ScrollTo(Owner.First+(e.Y<Thumb().Top ? -Owner.VisibleLines : Owner.VisibleLines)); Invalidate(); }
        protected override void OnMouseMove(MouseEventArgs e) { base.OnMouseMove(e); if(dragging) Owner.ScrollTo(lineStart+(e.Y-dragStart)*Math.Max(1,Owner.Total-Owner.VisibleLines)/Math.Max(1,Height-Thumb().Height)); }
        protected override void OnMouseUp(MouseEventArgs e) { base.OnMouseUp(e); dragging=false;Capture=false;Invalidate(); }
        protected override void OnMouseWheel(MouseEventArgs e) { Owner.ScrollTo(Owner.First-e.Delta/120*3); }
    }
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr window,int message,IntPtr w,IntPtr l);
    readonly LogText content; readonly ScrollRail rail; string sourceText="";
    int First {get {return (int)SendMessage(content.Handle,0xCE,IntPtr.Zero,IntPtr.Zero);}}
    int Total {get {return (int)SendMessage(content.Handle,0xBA,IntPtr.Zero,IntPtr.Zero);}}
    int VisibleLines {get {return Math.Max(1,content.ClientSize.Height/content.Font.Height);}}
    void ScrollTo(int line) {line=Math.Max(0,Math.Min(line,Math.Max(0,Total-VisibleLines)));SendMessage(content.Handle,0xB6,IntPtr.Zero,(IntPtr)(line-First));rail.Invalidate();}
    public DarkLog() {
        BackColor=Color.FromArgb(14,14,13);
        rail=new ScrollRail {Dock=DockStyle.Right,Width=16,Owner=this};
        content=new LogText {Dock=DockStyle.Fill,Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.None,BorderStyle=BorderStyle.None,BackColor=BackColor,ForeColor=Color.Silver,AccessibleName="Журнал установки"};
        content.Changed=delegate {rail.Invalidate();}; content.TextChanged+=delegate {rail.Invalidate();};
        Controls.Add(content);Controls.Add(rail);
    }
    public override string Text { get {return content==null ? "" : content.Text;} set {sourceText=value;if(content!=null) content.Text=NativeText.T(value);} }
    public void RefreshLanguage() {if(content!=null) {content.Text=NativeText.T(sourceText);ScrollTo(Total);}}
    public void AppendText(string value) {sourceText+=value;content.AppendText(NativeText.T(value));content.SelectionStart=content.TextLength;content.ScrollToCaret();ScrollTo(Total);rail.Invalidate();}
    protected override void OnForeColorChanged(EventArgs e) {base.OnForeColorChanged(e);if(content!=null) content.ForeColor=ForeColor;}
    protected override void OnFontChanged(EventArgs e) {base.OnFontChanged(e);if(content!=null) content.Font=Font;}
}
class DarkCheckBox : CheckBox {
    public DarkCheckBox() {SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);Cursor=Cursors.Hand;}
    protected override void OnPaint(PaintEventArgs e) {
        e.Graphics.Clear(BackColor); int y=(Height-15)/2;
        using(var brush=new SolidBrush(Checked ? Color.FromArgb(185,171,130) : Color.FromArgb(22,22,20))) e.Graphics.FillRectangle(brush,0,y,15,15);
        using(var pen=new Pen(Color.FromArgb(99,98,88))) e.Graphics.DrawRectangle(pen,0,y,15,15);
        if(Checked) using(var pen=new Pen(Color.Black,2)) e.Graphics.DrawLines(pen,new Point[]{new Point(3,y+7),new Point(6,y+11),new Point(12,y+4)});
        TextRenderer.DrawText(e.Graphics,Text,Font,new Rectangle(24,0,Width-24,Height),Enabled ? ForeColor : Color.Gray,TextFormatFlags.Left|TextFormatFlags.VerticalCenter);
        if(Focused) ControlPaint.DrawFocusRectangle(e.Graphics,new Rectangle(22,2,Width-24,Height-4),ForeColor,BackColor);
    }
}
class InstallProgress : Control {
    public int Value; public bool Running;
    int offset; readonly System.Windows.Forms.Timer animation=new System.Windows.Forms.Timer { Interval=35 };
    public InstallProgress() { DoubleBuffered=true; animation.Tick+=delegate { offset=(offset+5)%Math.Max(1,Width+180); Invalidate(); }; animation.Start(); }
    protected override void OnPaint(PaintEventArgs e) {
        e.Graphics.Clear(Color.FromArgb(28,28,26));
        using(var brush=new SolidBrush(Color.FromArgb(185,171,130))) {
            if(Running) e.Graphics.FillRectangle(brush,offset-180,0,180,Height);
            else e.Graphics.FillRectangle(brush,0,0,Width*Value/100,Height);
        }
    }
    protected override void Dispose(bool disposing) { if(disposing) animation.Dispose(); base.Dispose(disposing); }
}
class Maintenance : DarkWindow {
    readonly Label status = new Label();
    readonly DarkLog log = new DarkLog();
    Button action, cancel, browse;
    readonly TextBox folder = new TextBox();
    readonly InstallProgress progress = new InstallProgress();
    readonly CheckBox shortcut = new DarkCheckBox();
    readonly Label components = new Label();
    readonly Label steps = new Label();
    string operation, target, package;
    bool busy, complete, writeShortcut;
    static readonly Color muted=Color.FromArgb(157,157,147);
    [STAThread] static void Main(string[] args) {
        AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
        AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
        if (args.Length == 3 && args[0] == "--test-install") {
            try {
                string stage = Path.Combine(args[2], "..", "installer-test-stage-" + Guid.NewGuid().ToString("N"));
                var release = PackageInstaller.Stage(args[1], stage, delegate {});
                PackageInstaller.Install(args[2], stage, release, delegate {});
                Environment.Exit(0);
            } catch (Exception e) { File.WriteAllText(args[2] + ".error.txt", e.ToString()); Environment.Exit(1); }
            return;
        }
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Maintenance(args));
    }
    Maintenance(string[] args) {
        operation = args.Length > 0 ? args[0] : "--setup";
        target = args.Length > 1 ? Path.GetFullPath(args[1]) : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EFTGPS");
        package = args.Length > 2 ? args[2] : null;
        NativeText.English=System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName!="ru";
        bool data=operation=="--data";
        Text = data ? "EFT GPS · Обновление базы" : "EFT GPS · Установка";
        ClientSize = new Size(820,720);
        Image branding=Icon.ToBitmap();
        using(var resource=System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream("installer-logo.png")) if(resource!=null) using(var image=Image.FromStream(resource)) branding=new Bitmap(image);
        var logo=new PictureBox { Bounds=new Rectangle(28,24,62,62), Image=branding, SizeMode=PictureBoxSizeMode.Zoom };
        Controls.Add(logo);
        TextAt("T_S_U_Y_U EFT GPS",106,22,560,40,22,ForeColor);
        TextAt(data ? "ОБНОВЛЕНИЕ СПРАВОЧНИКА" : "УСТАНОВКА ПРИЛОЖЕНИЯ  /  1.7.0",108,67,660,24,9,muted);
        steps.SetBounds(28,108,764,32); steps.Text="01  Подготовка     /     02  Установка     /     03  Готово"; steps.ForeColor=Color.FromArgb(185,171,130);
        Controls.Add(steps);
        TextAt(data ? "Свежая база — привычный прогресс" : "Тарков под рукой. Даже без интернета.",28,154,764,38,18,ForeColor);
        TextAt(data ? "Загрузим актуальные справочные данные. Если загрузка прервётся, предыдущая база останется доступной." : "Карты, задания, предметы и GPS в отдельном приложении.\nСправочник и изображения входят в комплект; скачивать базу при установке не нужно.",28,201,764,55,10,muted);
        TextAt("ПАПКА ПРИЛОЖЕНИЯ",28,274,764,23,9,muted);
        folder.SetBounds(28,305,620,30); folder.Text=target; folder.BackColor=Color.FromArgb(19,19,18); folder.ForeColor=ForeColor; folder.BorderStyle=BorderStyle.FixedSingle;
        browse=ButtonAt("Обзор…",660,299,132,false);
        browse.Click+=delegate { using(var picker=new DarkFolderPicker(folder.Text)) if(picker.ShowDialog(this)==DialogResult.OK) folder.Text=picker.SelectedPath; };
        shortcut.SetBounds(28,350,764,26); shortcut.Text="Создать ярлык на рабочем столе"; shortcut.Checked=true; shortcut.Visible=!data;
        components.SetBounds(28,387,764,84); components.ForeColor=muted;
        string runtime=RuntimeVersion();
        string systemStatus; try {CheckPlatform();systemStatus="✓ Windows и .NET Framework — готовы к работе";} catch(Exception e) {systemStatus="○ "+e.Message;}
        components.Text="КОМПОНЕНТЫ\n"+(runtime==null ? "○ WebView2 — установим из автономного пакета Microsoft" : "✓ WebView2 "+runtime+" — уже установлен")+"\n"+systemStatus+"\n✓ Node.js и модуль GPS — в комплекте. Отдельные драйверы не нужны.";
        log.SetBounds(28,479,764,88); 
        log.BackColor=Color.FromArgb(14,14,13); log.ForeColor=muted;  log.Font=new Font("Segoe UI",9);
        log.Text="Прогресс, личные метки и настройки GPS сохраняются при обновлении.\r\n"+(data ? "Для обновления справочника нужен интернет." : "Windows 10/11 x64 · .NET Framework 4.7.2 или новее.\r\nПеред заменой файлов создаётся резервная копия. Проверяем целостность каждого файла.");
        status.SetBounds(28,588,764,26); status.ForeColor=ForeColor; status.Text="Всё готово к "+(data ? "обновлению базы" : "установке");
        progress.SetBounds(28,624,764,4);
        cancel=ButtonAt("Отмена",448,651,132,false); cancel.Click+=delegate { Close(); };
        action=ButtonAt(data ? "Обновить базу" : "Установить",592,651,200,true);
        action.Click+=async delegate {
            if(complete) { Process.Start(new ProcessStartInfo(Path.Combine(target,"Tarkov Offline.exe")) {WorkingDirectory=target,UseShellExecute=false}); Close(); return; }
            try {
                target=Path.GetFullPath(folder.Text.Trim());
                if(String.IsNullOrWhiteSpace(folder.Text)) throw new IOException("Выберите папку приложения.");
                if(!data && Directory.Exists(target) && Directory.GetFileSystemEntries(target).Length>0 && !File.Exists(Path.Combine(target,"Tarkov Offline.exe"))) throw new IOException("В этой папке уже есть другие файлы. Выберите пустую папку или папку EFT GPS.");
                CheckPlatform();
                using(var confirm=new InstallConfirmation(data ? "Обновить локальную базу?" : "Установить EFT GPS?",
                    "Папка: "+target+"\n\nЗакройте окно приложения перед продолжением. Автосъёмку GPS после запуска нужно будет включить заново.\n\n"+(data ? "Понадобится интернет. Предыдущая база будет сохранена." : "Проверим пакет и установим недостающий WebView2.\nЯрлык на рабочем столе: "+(shortcut.Checked ? "создать / обновить" : "не создавать"))+"\nЛичный прогресс и настройки останутся на месте.",data ? "Обновить" : "Установить")) if(confirm.ShowDialog(this)!=DialogResult.OK) return;
                writeShortcut=shortcut.Checked;
                busy=true; action.Enabled=false; cancel.Enabled=false; browse.Enabled=false; folder.Enabled=false; shortcut.Enabled=false;
                steps.Text="✓  Подготовка     /     02  Установка     /     03  Готово"; status.Text="Подготовка файлов…"; progress.Running=true; NativeText.Apply(this);
                await Task.Run((Action)RunOperation);
                complete=true; progress.Value=100; steps.Text="✓  Подготовка     /     ✓  Установка     /     ✓  Готово";
                status.Text=data ? "База обновлена. Можно возвращаться в Тарков." : "Приложение установлено. Всё готово к запуску.";
                action.Text="Открыть приложение"; cancel.Text="Закрыть";
            } catch(Exception e) {
                status.Text="Не удалось завершить "+(data ? "обновление базы" : "установку");
                Append(e.Message+"\r\nИсправьте причину и повторите попытку. Личный прогресс не изменён.");
                try { Directory.CreateDirectory(Path.Combine(target,"userdata")); File.WriteAllText(Path.Combine(target,"userdata","maintenance-error.log"),e.ToString()); } catch {}
                action.Text="Повторить"; folder.Enabled=true; browse.Enabled=operation=="--setup"; shortcut.Enabled=true;
            } finally { busy=false; action.Enabled=true; cancel.Enabled=true; progress.Running=false; progress.Invalidate(); NativeText.Apply(this); }
        };
        FormClosing+=delegate(object sender,FormClosingEventArgs e) { if(busy) {e.Cancel=true; status.Text="Идёт установка. Дождитесь завершения, чтобы не повредить файлы.";} };
        Controls.AddRange(new Control[]{folder,browse,shortcut,components,log,status,progress,cancel,action});
        AcceptButton=action; CancelButton=cancel;
        var russian=ButtonAt("RU",650,28,66,false);
        var english=ButtonAt("EN",724,28,68,false);
        russian.Height=english.Height=32;
        russian.AccessibleName="Русский"; english.AccessibleName="English";
        Action refreshLanguageButtons=delegate {
            foreach(var button in new[]{russian,english}) {
                bool selected=(button==english)==NativeText.English;
                button.BackColor=selected ? Color.FromArgb(185,171,130) : Color.FromArgb(17,17,17);
                button.ForeColor=selected ? Color.Black : Color.Gainsboro;
                button.FlatAppearance.BorderColor=selected ? Color.FromArgb(185,171,130) : Color.FromArgb(67,66,59);
                button.FlatAppearance.MouseOverBackColor=selected ? Color.FromArgb(212,198,156) : Color.FromArgb(33,33,30);
                button.AccessibleDescription=selected ? "Selected / Выбран" : "";
            }
        };
        russian.Click+=delegate {NativeText.Select(false);refreshLanguageButtons();};
        english.Click+=delegate {NativeText.Select(true);refreshLanguageButtons();};
        Controls.AddRange(new Control[]{russian,english});refreshLanguageButtons();
        if(data || operation=="--install") {folder.ReadOnly=true; browse.Enabled=false;}
    }
    void Append(string value) { if(IsDisposed) return; BeginInvoke((Action)delegate { log.AppendText("\r\n"+value); if(busy) status.Text=NativeText.T(value.Length>100 ? value.Substring(0,97)+"…" : value); }); }
    static void CheckPlatform() {
        if(!Environment.Is64BitOperatingSystem || Environment.OSVersion.Platform!=PlatformID.Win32NT) throw new IOException("Для приложения нужна 64-разрядная Windows 10 или 11.");
        using(var windows=Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion")) {
            int build; if(windows==null || !Int32.TryParse(Convert.ToString(windows.GetValue("CurrentBuildNumber")),out build) || build<18362) throw new IOException("Для приложения нужна Windows 10 версии 1903 или новее, либо Windows 11 (x64).");
        }
        using(var key=Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full")) {
            if(key==null || Convert.ToInt32(key.GetValue("Release",0))<461808) throw new IOException("Необходим .NET Framework 4.7.2 или новее. Установите компонент через Центр обновления Windows и повторите установку.");
        }
    }
    static string RuntimeVersion() {
        const string client=@"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
        foreach(var hive in new Microsoft.Win32.RegistryHive[]{Microsoft.Win32.RegistryHive.LocalMachine,Microsoft.Win32.RegistryHive.CurrentUser})
            using(var registry=Microsoft.Win32.RegistryKey.OpenBaseKey(hive,Microsoft.Win32.RegistryView.Registry32))
            using(var key=registry.OpenSubKey(client)) { Version version; if(key!=null && Version.TryParse(Convert.ToString(key.GetValue("pv")),out version) && version.Major>0) return version.ToString(); }
        return null;
    }
    static void RequireSpace(string path, long bytes) {
        string root=Path.GetPathRoot(Path.GetFullPath(path));
        var drive=new DriveInfo(root);
        if(drive.IsReady && drive.AvailableFreeSpace<bytes) throw new IOException("Недостаточно места на диске "+root+". Для этого этапа нужно не менее "+Math.Ceiling(bytes/1073741824d)+" ГБ свободного места.");
    }
    void StopServer() {
        foreach (var p in Process.GetProcessesByName("TarkovDesktopHost")) {
            try { if (String.Equals(p.MainModule.FileName, Path.Combine(target, "runtime", "TarkovDesktopHost.exe"), StringComparison.OrdinalIgnoreCase) && !p.WaitForExit(5000)) throw new IOException("Сначала закройте окно EFT GPS"); } catch (System.ComponentModel.Win32Exception) {}
        }
        try {
            var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:38471/api/desktop/stop");
            request.Method = "POST"; request.Timeout = 3000; request.ContentType = "application/json"; request.Headers["Origin"] = "http://127.0.0.1:38471";
            string instance;
            using (var sha = SHA256.Create()) instance = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(target.TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant()))).Replace("-", "").ToLowerInvariant();
            byte[] bytes = Encoding.UTF8.GetBytes("{\"instance\":\"" + instance + "\"}");
            request.ContentLength = bytes.Length;
            using (var output = request.GetRequestStream()) output.Write(bytes, 0, bytes.Length);
            using (var response = request.GetResponse()) {}
            Thread.Sleep(800);
        } catch (WebException e) {
            if (e.Status == WebExceptionStatus.ConnectFailure) return;
            throw new IOException("Не удалось завершить локальную службу. Закройте приложение и повторите через две минуты.", e);
        }
    }
    void RunOperation() {
        StopServer();
        if (operation == "--data") {
            var start = new ProcessStartInfo(Path.Combine(target, "runtime", "node.exe"), "\"" + Path.Combine(target, "scripts", "refresh.mjs") + "\"") { WorkingDirectory = target, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8 };
            using (var process = Process.Start(start)) {
                process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) Append(e.Data); };
                process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) Append(e.Data); };
                process.BeginOutputReadLine(); process.BeginErrorReadLine(); process.WaitForExit();
                if (process.ExitCode != 0) throw new IOException("Загрузка базы не завершена. Предыдущая база осталась на месте.");
            }
            return;
        }
        Append("Проверяем целостность пакета. Это может занять несколько минут…");
        bool embedded = package == null;
        if (embedded) package = ExtractEmbeddedPackage();
        string staged = Path.Combine(Path.GetTempPath(), "TarkovOffline-package-" + Guid.NewGuid().ToString("N"));
        try {
            var release = PackageInstaller.Stage(package, staged, Append);
            long unpacked=0; foreach(var file in release.files) unpacked+=file.size;
            RequireSpace(target,unpacked*2+512L*1024*1024);
            EnsureRuntime(staged);
            string backup = PackageInstaller.Install(target, staged, release, Append);
            Append("Установлена версия " + release.version + ". Резервная копия изменённых файлов: " + backup);
            if(writeShortcut) CreateShortcut();
        } finally {
            string temporaryRoot = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            string resolved = Path.GetFullPath(staged);
            try {
                if (resolved.StartsWith(temporaryRoot, StringComparison.OrdinalIgnoreCase) && Path.GetFileName(resolved).StartsWith("TarkovOffline-package-") && Directory.Exists(resolved)) Directory.Delete(resolved, true);
                if(embedded && Path.GetDirectoryName(Path.GetFullPath(package)).Equals(Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar),StringComparison.OrdinalIgnoreCase) && Path.GetFileName(package).StartsWith("TarkovOffline-payload-")) {File.Delete(package);package=null;}
            } catch(Exception cleanup) {Append("Не удалось удалить временные файлы: "+cleanup.Message);}
        }
    }
    void EnsureRuntime(string staged) {
        if(RuntimeVersion()!=null) { Append("WebView2 уже установлен. Повторная установка не требуется."); return; }
        string installer=Path.Combine(staged,"runtime","MicrosoftEdgeWebView2RuntimeInstallerX64.exe");
        if(!File.Exists(installer)) throw new IOException("В пакете нет автономного установщика WebView2. Используйте полный установщик EFT GPS.");
        Append("Установка Microsoft WebView2 из автономного пакета…");
        using(var process=Process.Start(new ProcessStartInfo(installer,"/silent /install") {UseShellExecute=false,CreateNoWindow=true})) {
            process.WaitForExit();
            if(process.ExitCode!=0 && process.ExitCode!=3010) throw new IOException("WebView2 не установлен. Код Microsoft: "+process.ExitCode+". Проверьте права доступа и повторите установку.");
            if(RuntimeVersion()==null) throw new IOException("WebView2 ещё не готов к работе. Перезагрузите Windows и повторите установку.");
        }
        Append("Microsoft WebView2 установлен.");
    }
    string ExtractEmbeddedPackage() {
        byte[] magic = Encoding.ASCII.GetBytes("TKVSETUP1");
        using (var stream = File.OpenRead(Application.ExecutablePath)) {
            stream.Seek(-(magic.Length + 8 + 32), SeekOrigin.End);
            var reader = new BinaryReader(stream);
            long length = reader.ReadInt64(); byte[] expectedHash = reader.ReadBytes(32); byte[] actualMagic = reader.ReadBytes(magic.Length);
            if (Encoding.ASCII.GetString(actualMagic) != "TKVSETUP1" || length <= 0 || length > stream.Length - 49) throw new IOException("Не найден пакет установки. Запустите полный установщик.");
            RequireSpace(Path.GetTempPath(),length+4L*1024*1024*1024);
            stream.Seek(-(magic.Length + 8 + 32 + length), SeekOrigin.End);
            string output = Path.Combine(Path.GetTempPath(), "TarkovOffline-payload-" + Guid.NewGuid().ToString("N") + ".zip");
            try {
            using (var targetFile = File.Create(output)) {
                byte[] buffer = new byte[1024 * 1024]; long remaining = length;
                while (remaining > 0) { int count = stream.Read(buffer, 0, (int)Math.Min(buffer.Length, remaining)); if (count == 0) throw new IOException("Повреждён установщик"); targetFile.Write(buffer, 0, count); remaining -= count; }
            }
            string expected = BitConverter.ToString(expectedHash).Replace("-", "").ToLowerInvariant();
            if (PackageInstaller.Hash(output) != expected) {File.Delete(output); throw new IOException("Установщик повреждён. Скопируйте пакет заново.");}
            return output;
            } catch { if(File.Exists(output)) File.Delete(output); throw; }
        }
    }
    void CreateShortcut() {
        Type type = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(type);
        string location = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "T_S_U_Y_U EFT GPS.lnk");
        object shortcut = type.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { location });
        shortcut.GetType().InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { Path.Combine(target, "EFT GPS.exe") });
        shortcut.GetType().InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { target });
        shortcut.GetType().InvokeMember("IconLocation", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { Path.Combine(target, "public", "icons", "app.ico") + ",0" });
        shortcut.GetType().InvokeMember("Save", System.Reflection.BindingFlags.InvokeMethod, null, shortcut, null);
    }
}



