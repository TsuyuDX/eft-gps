using System;
using System.IO;
using System.Net;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// Standalone window overlay: no game hooks, memory access, injected DLLs or input simulation.
public sealed class RaidMapWindow : Form {
    public readonly PictureBox Canvas=new PictureBox {Dock=DockStyle.Fill,SizeMode=PictureBoxSizeMode.Zoom,BackColor=Color.FromArgb(8,11,12)};
    protected override bool ShowWithoutActivation {get{return true;}}
    protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x00000020|0x08000000|0x00080000|0x00000080;return p;}}
    public RaidMapWindow() {
        Text="EFT GPS · Карта поверх игры";FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;
        BackColor=Color.FromArgb(8,11,12);Opacity=0.78;Controls.Add(Canvas);
    }
    protected override void WndProc(ref Message m) {
        if(m.Msg==0x0084){m.Result=new IntPtr(-1);return;}
        if(m.Msg==0x0021){m.Result=new IntPtr(3);return;}
        base.WndProc(ref m);
    }
    public void ReplaceImage(Bitmap image) {var old=Canvas.Image;Canvas.Image=image;if(old!=null)old.Dispose();}
    protected override void Dispose(bool disposing) {if(disposing && Canvas.Image!=null){Canvas.Image.Dispose();Canvas.Image=null;}base.Dispose(disposing);}
}
public sealed class OverlayHost : Form {
    [DllImport("user32.dll",SetLastError=true)] static extern bool RegisterHotKey(IntPtr window,int id,uint modifiers,uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr window,int id);
    readonly WebView2 web=new WebView2 {Dock=DockStyle.Fill,DefaultBackgroundColor=Color.FromArgb(8,11,12)};
    readonly RaidMapWindow overlay=new RaidMapWindow();
    readonly Timer frames=new Timer {Interval=1000}, heartbeat=new Timer {Interval=15000};
    readonly Label status=new Label {AutoSize=false,ForeColor=Color.FromArgb(194,177,128),Text="Загружаем карту…"};
    readonly Button toggle=new Button {Text="Показать карту · Alt+M",Enabled=false};
    readonly ComboBox map=new ComboBox {DropDownStyle=ComboBoxStyle.DropDownList};
    readonly ComboBox mode=new ComboBox {DropDownStyle=ComboBoxStyle.DropDownList};
    readonly ComboBox shortcut=new ComboBox {DropDownStyle=ComboBoxStyle.DropDownList};
    readonly TrackBar opacity=new TrackBar {Minimum=35,Maximum=95,Value=78,TickStyle=TickStyle.None};
    readonly List<string> ids=new List<string>();
    readonly string root,origin;
    readonly bool integrated;
    bool ready,capturing,closing,registered,pinging;int navigation;
    [STAThread] public static void Main(string[] args) {
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        int port=38479;if(args.Length!=2 || (args[0]!="--preview-port" && args[0]!="--app-port") || !Int32.TryParse(args[1],out port) || port<1024 || port>65535)return;
        string root=Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,".."));
        bool created;using(var mutex=new System.Threading.Mutex(true,"Local\\EFTGPS-OverlayTest-"+port,out created)) {
            if(!created){if(args[0]=="--preview-port")MessageBox.Show("Тестовый оверлей уже открыт.","EFT GPS");return;}
            Application.Run(new OverlayHost(root,"http://127.0.0.1:"+port,args[0]=="--app-port"));
        }
    }
    OverlayHost(string appRoot,string localOrigin,bool appIntegrated) {
        root=appRoot;origin=localOrigin;integrated=appIntegrated;NativeText.English=NativeText.Preferred(root);Text=integrated?"EFT GPS · Overlay Beta":"EFT GPS · Тест оверлея";
        if(integrated)heartbeat.Interval=1500;
        BackColor=Color.FromArgb(14,15,14);ForeColor=Color.FromArgb(232,224,202);Font=new Font("Segoe UI",10);
        Size=new Size(1160,800);MinimumSize=new Size(860,650);StartPosition=FormStartPosition.CenterScreen;
        Icon=new Icon(Path.Combine(root,"public","icons","app.ico"));
        foreach(var choice in new[]{map,mode,shortcut}){choice.BackColor=Color.FromArgb(30,31,28);choice.ForeColor=ForeColor;choice.FlatStyle=FlatStyle.Flat;}
        map.AccessibleName="Карта";mode.AccessibleName="Режим игры";shortcut.AccessibleName="Горячая клавиша";opacity.AccessibleName="Непрозрачность карты";
        var panel=new Panel {Dock=DockStyle.Top,Height=158,BackColor=BackColor};
        panel.Controls.Add(new Label {Text="КАРТА ПОВЕРХ ИГРЫ  /  ПРОТОТИП",Bounds=new Rectangle(18,12,700,25),Font=new Font("Segoe UI",12,FontStyle.Bold),ForeColor=ForeColor});
        map.SetBounds(18,48,210,32);mode.SetBounds(240,48,96,32);shortcut.SetBounds(348,48,150,32);
        opacity.SetBounds(510,45,145,34);toggle.SetBounds(670,46,285,36);toggle.BackColor=Color.FromArgb(178,158,105);toggle.ForeColor=Color.Black;toggle.FlatStyle=FlatStyle.Flat;
        status.SetBounds(18,89,1080,25);
        panel.Controls.Add(new Label {Text="Карта пропускает мышь в игру. Настройки — здесь. Для игры нужен оконный режим без рамки. Закройте это окно, чтобы выключить оверлей.",Bounds=new Rectangle(18,120,1080,30),ForeColor=Color.FromArgb(158,159,147),Font=new Font("Segoe UI",9)});
        panel.Controls.AddRange(new Control[]{map,mode,shortcut,opacity,toggle,status});Controls.Add(web);Controls.Add(panel);
        string initialMode="regular";
        try{var profile=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"userdata","profile.json")));initialMode=Convert.ToString(profile["mode"]);}catch{}
        mode.Items.AddRange(new object[]{"PVP","PVE"});mode.SelectedIndex=initialMode=="pve"?1:0;
        shortcut.Items.AddRange(new object[]{"Alt+M","Ctrl+Shift+M","F8"});shortcut.SelectedIndex=0;
        var maps=new JavaScriptSerializer().Deserialize<List<Dictionary<string,object>>>(File.ReadAllText(Path.Combine(root,"public","data",NativeText.English?"en/maps.json":"maps.json")));
        foreach(var item in maps){ids.Add(Convert.ToString(item.ContainsKey("routeSlug")?item["routeSlug"]:item["normalizedName"]));map.Items.Add(Convert.ToString(item["name"]));}
        map.SelectedIndex=Math.Max(0,ids.IndexOf("factory"));
        map.SelectedIndexChanged+=async delegate {await NavigateMap();};mode.SelectedIndexChanged+=async delegate {await NavigateMap();};
        shortcut.SelectedIndexChanged+=delegate {BindShortcut();};
        opacity.ValueChanged+=delegate {overlay.Opacity=opacity.Value/100d;};
        toggle.Click+=async delegate {await ToggleMap();};
        frames.Tick+=async delegate {if(overlay.Visible)await CaptureMap();};
        heartbeat.Tick+=async delegate {if(pinging)return;pinging=true;try{using(var client=new WebClient()) {
                if(integrated){var state=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(await client.DownloadStringTaskAsync(origin+"/api/overlay"));if(!Convert.ToBoolean(state["enabled"])){Close();return;}}
                await client.DownloadStringTaskAsync(origin+"/api/health");
            }}catch{if(integrated)Close();}finally{pinging=false;}};
        Shown+=async delegate {BindShortcut();await InitializeWeb();heartbeat.Start();};
        NativeText.Apply(this);
        FormClosing+=delegate {closing=true;frames.Stop();heartbeat.Stop();if(registered)UnregisterHotKey(Handle,1);overlay.Close();};
        FormClosed+=delegate {frames.Dispose();heartbeat.Dispose();overlay.Dispose();};
    }
    void SetStatus(string text){status.Text=NativeText.T(text);}
    void BindShortcut() {
        if(registered){UnregisterHotKey(Handle,1);registered=false;}
        uint modifiers=0x4000,key=0x4D;
        if(shortcut.SelectedIndex==0)modifiers|=1;else if(shortcut.SelectedIndex==1)modifiers|=2|4;else key=0x77;
        registered=RegisterHotKey(Handle,1,modifiers,key);
        UpdateToggleLabel();
        SetStatus(registered?"Горячая клавиша: "+shortcut.Text+". Прозрачность регулируется ползунком.":"Клавиша занята другим приложением. Выберите другую комбинацию.");
    }
    void UpdateToggleLabel(){toggle.Text=NativeText.T(overlay.Visible?"Скрыть карту · ":"Показать карту · ")+shortcut.Text;}
    async Task InitializeWeb() {
        try {
            var environment=await CoreWebView2Environment.CreateAsync(null,Path.Combine(root,"userdata","webview2-overlay-test"));
            if(closing)return;await web.EnsureCoreWebView2Async(environment);var core=web.CoreWebView2;
            core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsStatusBarEnabled=false;
            core.Settings.AreBrowserAcceleratorKeysEnabled=false;core.Settings.AreHostObjectsAllowed=false;core.Settings.AreDefaultScriptDialogsEnabled=false;
            core.Settings.IsPasswordAutosaveEnabled=false;core.Settings.IsGeneralAutofillEnabled=false;
            core.PermissionRequested+=delegate(object sender,CoreWebView2PermissionRequestedEventArgs e){e.State=CoreWebView2PermissionState.Deny;};
            core.NewWindowRequested+=delegate(object sender,CoreWebView2NewWindowRequestedEventArgs e){e.Handled=true;};
            core.DownloadStarting+=delegate(object sender,CoreWebView2DownloadStartingEventArgs e){e.Cancel=true;};
            core.NavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){Uri uri;if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out uri)||uri.GetLeftPart(UriPartial.Authority)!=origin){e.Cancel=true;}};
            core.NavigationCompleted+=delegate(object sender,CoreWebView2NavigationCompletedEventArgs e){ready=e.IsSuccess;toggle.Enabled=ready;SetStatus(ready?"Карта готова. Нажмите "+shortcut.Text+" — управление останется в игре.":"Карта недоступна. Перезапустите тестовый оверлей.");};
            await NavigateMap();
        } catch(Exception e){SetStatus("Не удалось открыть карту: "+e.Message);}
    }
    async Task NavigateMap() {
        if(web.CoreWebView2==null || map.SelectedIndex<0 || closing)return;
        overlay.Hide();frames.Stop();ready=false;toggle.Enabled=false;navigation++;
        UpdateToggleLabel();
        web.CoreWebView2.Navigate(origin+"/?overlay=1&map="+ids[map.SelectedIndex]+"&mode="+mode.SelectedIndex+"#/map/"+(mode.SelectedIndex==1?"pve":"regular")+"/"+ids[map.SelectedIndex]);
        await Task.FromResult(0);
    }
    async Task<bool> CaptureMap() {
        if(!ready||capturing||closing)return false;capturing=true;int generation=navigation;
        try {
            string loaded=await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('#map-image')?.complete && document.querySelector('#map-image')?.naturalWidth && !document.body.classList.contains('booting'))");
            if(loaded!="true"){SetStatus("Подготовка карты…");return false;}
            using(var stream=new MemoryStream()) {
                await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
                if(closing || generation!=navigation)return false;stream.Position=0;
                using(var image=Image.FromStream(stream))overlay.ReplaceImage(new Bitmap(image));
            }
            return true;
        } catch(Exception e){if(!closing)SetStatus("Не удалось обновить вид карты: "+e.Message);return false;}
        finally{capturing=false;}
    }
    async Task ToggleMap() {
        if(overlay.Visible){overlay.Hide();frames.Stop();UpdateToggleLabel();return;}
        if(!await CaptureMap())return;
        if(closing)return;
        Rectangle screen=Screen.FromControl(this).Bounds;
        int width=(int)(screen.Width*0.78),height=(int)(screen.Height*0.78);
        overlay.Bounds=new Rectangle(screen.Left+(screen.Width-width)/2,screen.Top+(screen.Height-height)/2,width,height);
        overlay.Show();frames.Start();UpdateToggleLabel();
    }
    async void HandleShortcut(){try{await ToggleMap();}catch(Exception e){if(!closing)SetStatus(e.Message);}}
    protected override void WndProc(ref Message m) {
        if(m.Msg==0x0312 && m.WParam.ToInt32()==1){HandleShortcut();return;}
        base.WndProc(ref m);
    }
}
