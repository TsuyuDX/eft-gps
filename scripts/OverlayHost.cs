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

// The desktop host reuses this renderer in-process. The standalone entry point is for developer tests only.
public sealed class RaidMapWindow : Form {
    public readonly PictureBox Canvas=new PictureBox {Dock=DockStyle.Fill,SizeMode=PictureBoxSizeMode.Zoom,BackColor=Color.FromArgb(8,11,12)};
    protected override bool ShowWithoutActivation {get{return true;}}
    protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x00000020|0x08000000|0x00080000|0x00000080;return p;}}
    public RaidMapWindow() {
        Text="EFT GPS · Карта поверх игры";FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;TopMost=true;
        BackColor=Color.FromArgb(121,112,83);Padding=new Padding(1);Opacity=0.78;Controls.Add(Canvas);
        var caption=new Label {Name="caption",Dock=DockStyle.Top,Height=30,Padding=new Padding(12,0,12,0),BackColor=Color.FromArgb(15,17,15),ForeColor=Color.FromArgb(216,206,172),Font=new Font("Segoe UI",9),TextAlign=ContentAlignment.MiddleLeft};Controls.Add(caption);caption.BringToFront();
    }
    public void SetCaption(string title,string hotkey){Controls["caption"].Text="⌖  "+title+"    ·    "+hotkey;}
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
    readonly bool embedded;
    bool applyingSettings,pendingShow,resourcesDisposed;DateTime pendingSince;int overlaySize=78;string overlayPosition="center",settingsSignature="",failure="";
    bool autoMap=true,follow,labels=true;
    protected override bool ShowWithoutActivation {get{return embedded;}}
    public Dictionary<string,object> RuntimeState(){return new Dictionary<string,object>{{"running",ready&&!closing},{"visible",overlay.Visible&&!closing},{"hotkeyRegistered",registered&&!closing},{"error",!String.IsNullOrEmpty(failure)?failure:ready&&!registered?"hotkey-in-use":""}};}
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
    public OverlayHost(string appRoot,string localOrigin,bool appIntegrated,bool appEmbedded=false) {
        root=appRoot;origin=localOrigin;integrated=appIntegrated;embedded=appEmbedded;NativeText.English=NativeText.Preferred(root);Text=integrated?"EFT GPS · Overlay Beta":"EFT GPS · Тест оверлея";
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
        if(embedded){panel.Visible=false;ShowInTaskbar=false;FormBorderStyle=FormBorderStyle.None;StartPosition=FormStartPosition.Manual;Location=new Point(-32000,-32000);Opacity=0.01;}
        string initialMode="regular";
        try{var profile=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"userdata","profile.json")));initialMode=Convert.ToString(profile["mode"]);}catch{}
        mode.Items.AddRange(new object[]{"PVP","PVE"});mode.SelectedIndex=initialMode=="pve"?1:0;
        shortcut.Items.AddRange(new object[]{"Alt+M","Ctrl+Shift+M","F8"});shortcut.SelectedIndex=0;
        var maps=new JavaScriptSerializer().Deserialize<List<Dictionary<string,object>>>(File.ReadAllText(Path.Combine(root,"public","data",NativeText.English?"en/maps.json":"maps.json")));
        foreach(var item in maps){ids.Add(Convert.ToString(item.ContainsKey("routeSlug")?item["routeSlug"]:item["normalizedName"]));map.Items.Add(Convert.ToString(item["name"]));}
        map.SelectedIndex=Math.Max(0,ids.IndexOf("factory"));
        map.SelectedIndexChanged+=async delegate {if(!applyingSettings)await NavigateMap();};mode.SelectedIndexChanged+=async delegate {if(!applyingSettings)await NavigateMap();};
        shortcut.SelectedIndexChanged+=delegate {if(!applyingSettings)BindShortcut();};
        opacity.ValueChanged+=delegate {overlay.Opacity=opacity.Value/100d;};
        toggle.Click+=async delegate {await ToggleMap();};
        frames.Tick+=async delegate {
            if(pendingShow && DateTime.UtcNow-pendingSince>TimeSpan.FromSeconds(30)){pendingShow=false;frames.Stop();failure="map-unavailable";UpdateToggleLabel();return;}
            if(overlay.Visible||pendingShow){if(await CaptureMap() && pendingShow && !closing){pendingShow=false;PlaceOverlay();overlay.Show();UpdateToggleLabel();}}
        };
        heartbeat.Tick+=async delegate {if(pinging)return;pinging=true;try{using(var client=new WebClient()) {
                if(integrated){var state=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(await client.DownloadStringTaskAsync(origin+"/api/overlay"));if(!Convert.ToBoolean(state["enabled"])){Close();return;}}
                await client.DownloadStringTaskAsync(origin+"/api/health");
            }}catch{if(integrated)Close();}finally{pinging=false;}};
        Shown+=async delegate {BindShortcut();await InitializeWeb();if(!embedded)heartbeat.Start();};
        NativeText.Apply(this);
        FormClosing+=delegate {closing=true;frames.Stop();heartbeat.Stop();if(registered)UnregisterHotKey(Handle,1);overlay.Close();};
    }
    protected override void Dispose(bool disposing){
        if(disposing&&!resourcesDisposed){resourcesDisposed=true;closing=true;frames.Stop();heartbeat.Stop();if(registered&&IsHandleCreated){UnregisterHotKey(Handle,1);registered=false;}overlay.Dispose();frames.Dispose();heartbeat.Dispose();}
        base.Dispose(disposing);
    }
    static int SettingInt(Dictionary<string,object> settings,string key,int value,int low,int high){object raw;int parsed;if(settings.TryGetValue(key,out raw)&&Int32.TryParse(Convert.ToString(raw),out parsed))return Math.Max(low,Math.Min(high,parsed));return value;}
    static bool SettingBool(Dictionary<string,object> settings,string key,bool value){object raw;return settings.TryGetValue(key,out raw)&&raw is bool?(bool)raw:value;}
    public async Task ApplySettings(Dictionary<string,object> settings){
        if(closing)return;string signature=new JavaScriptSerializer().Serialize(settings);if(signature==settingsSignature)return;settingsSignature=signature;
        string oldNavigation=map.SelectedIndex+"/"+mode.SelectedIndex+"/"+autoMap+"/"+follow+"/"+labels;int oldShortcut=shortcut.SelectedIndex;
        applyingSettings=true;
        try{
            object raw;
            if(settings.TryGetValue("map",out raw)){int index=ids.IndexOf(Convert.ToString(raw));if(index>=0)map.SelectedIndex=index;}
            if(settings.TryGetValue("mode",out raw))mode.SelectedIndex=Convert.ToString(raw)=="pve"?1:0;
            if(settings.TryGetValue("hotkey",out raw)){int index=shortcut.Items.IndexOf(Convert.ToString(raw));if(index>=0)shortcut.SelectedIndex=index;}
            opacity.Value=SettingInt(settings,"opacity",78,35,95);overlaySize=SettingInt(settings,"size",78,25,95);frames.Interval=SettingInt(settings,"refreshMs",1000,500,2000);
            if(settings.TryGetValue("position",out raw)){string position=Convert.ToString(raw);if(Array.IndexOf(new[]{"center","top-left","top-right","bottom-left","bottom-right"},position)>=0)overlayPosition=position;}
            autoMap=SettingBool(settings,"autoMap",true);follow=SettingBool(settings,"follow",false);labels=SettingBool(settings,"labels",true);
        }finally{applyingSettings=false;}
        if(IsHandleCreated && shortcut.SelectedIndex!=oldShortcut)BindShortcut();
        if(overlay.Visible)PlaceOverlay();
        if(oldNavigation!=map.SelectedIndex+"/"+mode.SelectedIndex+"/"+autoMap+"/"+follow+"/"+labels)await NavigateMap();
    }
    void PlaceOverlay(){
        Rectangle screen=(Screen.PrimaryScreen??Screen.FromControl(this)).Bounds;
        int width=Math.Max(240,(int)(screen.Width*overlaySize/100d)),height=Math.Max(160,(int)(screen.Height*overlaySize/100d));
        int x=screen.Left+(screen.Width-width)/2,y=screen.Top+(screen.Height-height)/2;
        if(overlayPosition.EndsWith("left"))x=screen.Left+20;else if(overlayPosition.EndsWith("right"))x=screen.Right-width-20;
        if(overlayPosition.StartsWith("top"))y=screen.Top+20;else if(overlayPosition.StartsWith("bottom"))y=screen.Bottom-height-20;
        overlay.Bounds=new Rectangle(x,y,width,height);overlay.SetCaption(map.Text,shortcut.Text);
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
            core.NavigationCompleted+=delegate(object sender,CoreWebView2NavigationCompletedEventArgs e){if(closing)return;ready=e.IsSuccess;failure=ready?"":"map-unavailable";toggle.Enabled=ready;SetStatus(ready?"Карта готова. Нажмите "+shortcut.Text+" — управление останется в игре.":"Карта недоступна. Перезапустите оверлей в настройках.");};
            await NavigateMap();
        } catch(Exception e){failure="overlay-start-failed";SetStatus("Не удалось открыть карту: "+e.Message);}
    }
    async Task NavigateMap() {
        if(web.CoreWebView2==null || map.SelectedIndex<0 || closing)return;
        bool wasVisible=overlay.Visible||pendingShow;overlay.Hide();frames.Stop();ready=false;failure="";toggle.Enabled=false;navigation++;pendingShow=wasVisible;pendingSince=DateTime.UtcNow;
        UpdateToggleLabel();
        web.CoreWebView2.Navigate(origin+"/?overlay=1&autoMap="+(autoMap?"1":"0")+"&follow="+(follow?"1":"0")+"&labels="+(labels?"1":"0")+"&map="+ids[map.SelectedIndex]+"&mode="+mode.SelectedIndex+"#/map/"+(mode.SelectedIndex==1?"pve":"regular")+"/"+ids[map.SelectedIndex]);
        if(pendingShow)frames.Start();
        await Task.FromResult(0);
    }
    async Task<bool> CaptureMap() {
        if(!ready||capturing||closing)return false;capturing=true;int generation=navigation;
        try {
            string loaded=await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('#map-image')?.complete && document.querySelector('#map-image')?.naturalWidth && !document.body.classList.contains('booting'))");
            if(closing || generation!=navigation)return false;
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
    public async Task ToggleMap() {
        if(closing)return;
        if(overlay.Visible||pendingShow){pendingShow=false;overlay.Hide();frames.Stop();UpdateToggleLabel();return;}
        failure="";
        if(!await CaptureMap()){if(!closing){pendingShow=true;pendingSince=DateTime.UtcNow;frames.Start();}return;}
        if(closing)return;
        PlaceOverlay();
        overlay.Show();frames.Start();UpdateToggleLabel();
    }
    async void HandleShortcut(){try{await ToggleMap();}catch(Exception e){if(!closing)SetStatus(e.Message);}}
    protected override void WndProc(ref Message m) {
        if(m.Msg==0x0312 && m.WParam.ToInt32()==1){HandleShortcut();return;}
        base.WndProc(ref m);
    }
}
