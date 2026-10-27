using System;
using System.IO;
using System.Net;
using System.Drawing;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Reflection;
[assembly: AssemblyVersion("1.5.0.0")]
[assembly: AssemblyFileVersion("1.5.0.0")]

class DesktopHost : Form {
    readonly string root, origin;
    readonly WebView2 web = new WebView2();
    Panel serviceError;
    bool maintenance;
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window, int command);
    [STAThread] static void Main(string[] args) {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string root = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
        string origin = "http://127.0.0.1:38471";
        if (args.Length == 2 && args[0] == "--preview-port") {
            int port;
            if (!int.TryParse(args[1], out port) || port < 1024 || port > 65535) return;
            origin = "http://127.0.0.1:" + port;
        }
        string mutexId;
        using (var hash = System.Security.Cryptography.SHA256.Create()) mutexId = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(root.ToLowerInvariant() + origin))).Replace("-", "");
        bool created;
        using (var mutex = new Mutex(true, "Local\\TarkovOffline-" + mutexId, out created)) {
            if (!created) {
                foreach (var process in Process.GetProcessesByName("TarkovDesktopHost")) {
                    try { if (String.Equals(process.MainModule.FileName, Application.ExecutablePath, StringComparison.OrdinalIgnoreCase)) { ShowWindow(process.MainWindowHandle, 9); SetForegroundWindow(process.MainWindowHandle); break; } } catch {}
                }
                return;
            }
            Application.Run(new DesktopHost(root, origin));
        }
    }
    DesktopHost(string appRoot, string appOrigin) {
        root = appRoot; origin = appOrigin;
        Text = "Тарков GPS";
        BackColor = Color.Black;
        Size = new Size(1440, 950);
        MinimumSize = new Size(800, 600);
        StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.Dpi;
        Icon = new Icon(Path.Combine(root, "public", "icons", "app.ico"));
        web.Dock = DockStyle.Fill;
        web.DefaultBackgroundColor = Color.Black;
        Controls.Add(web);
        Shown += async delegate {
            try {
                int dark = 1, black = 0, white = 0x00FFFFFF;
                try {
                    DwmSetWindowAttribute(Handle, 20, ref dark, 4);
                    DwmSetWindowAttribute(Handle, 35, ref black, 4);
                    DwmSetWindowAttribute(Handle, 36, ref white, 4);
                    DwmSetWindowAttribute(Handle, 34, ref black, 4);
                } catch {}
                var options = new CoreWebView2EnvironmentOptions();
                options.AdditionalBrowserArguments = "--autoplay-policy=user-gesture-required";
                var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(root, "userdata", "webview2"), options);
                await web.EnsureCoreWebView2Async(environment);
                var core = web.CoreWebView2;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsZoomControlEnabled = false;
                core.Settings.IsPinchZoomEnabled = false;
                core.Settings.IsSwipeNavigationEnabled = false;
                core.Settings.IsGeneralAutofillEnabled = false;
                core.Settings.IsPasswordAutosaveEnabled = false;
                core.Settings.AreHostObjectsAllowed = false;
                core.Settings.AreDefaultScriptDialogsEnabled = false;
                core.Settings.IsBuiltInErrorPageEnabled = false;
                core.Profile.PreferredColorScheme = CoreWebView2PreferredColorScheme.Dark;
                core.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs e) { e.State = CoreWebView2PermissionState.Deny; };
                core.ContextMenuRequested += delegate(object sender, CoreWebView2ContextMenuRequestedEventArgs e) {
                    for (int i = e.MenuItems.Count - 1; i >= 0; i--) {
                        string name = e.MenuItems[i].Name;
                        bool copy = name == "copy" && e.ContextMenuTarget.HasSelection;
                        bool edit = e.ContextMenuTarget.IsEditable && (name == "cut" || name == "paste" || name == "pasteAndMatchStyle" || name == "undo" || name == "redo" || name == "selectAll");
                        if (!copy && !edit) e.MenuItems.RemoveAt(i);
                    }
                    if (e.MenuItems.Count == 0) e.Handled = true;
                };
                core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e) {
                    if (IsLocal(e.Uri) || e.Uri == "about:blank") return;
                    e.Cancel = true;
                    if (e.IsUserInitiated) OpenExternal(e.Uri);
                };
                core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e) {
                    e.Handled = true;
                    if (e.IsUserInitiated) OpenExternal(e.Uri);
                };
                core.DownloadStarting += delegate(object sender, CoreWebView2DownloadStartingEventArgs e) {
                    if (!e.DownloadOperation.Uri.StartsWith("blob:" + origin + "/", StringComparison.OrdinalIgnoreCase)) { e.Cancel = true; return; }
                    using (var dialog = new SaveFileDialog { Title = "Сохранить резервную копию", Filter = "Резервная копия (*.json)|*.json", FileName = "Tarkov-прогресс.json", DefaultExt = "json" }) {
                        if (dialog.ShowDialog(this) != DialogResult.OK) { e.Cancel = true; return; }
                        e.ResultFilePath = dialog.FileName;
                        e.Handled = true;
                    }
                };
                core.ScriptDialogOpening += delegate(object sender, CoreWebView2ScriptDialogOpeningEventArgs e) {
                    if (e.Kind == CoreWebView2ScriptDialogKind.Alert) { MessageBox.Show(this, e.Message, "Тарков GPS", MessageBoxButtons.OK, MessageBoxIcon.Information); e.Accept(); }
                };
                core.WebMessageReceived += delegate(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
                    if (!IsLocal(e.Source)) return;
                    string command;
                    try { command = e.TryGetWebMessageAsString(); } catch { return; }
                    if (command == "open-folder") { Process.Start(new ProcessStartInfo("explorer.exe", "\"" + root + "\"") { UseShellExecute = false }); return; }
                    if (command == "reload-interface") { web.Reload(); return; }
                    if (command == "update-data") StartMaintenance("--data", null);
                    if (command == "install-update") {
                        using (var dialog = new OpenFileDialog { Title = "Выберите пакет обновления Тарков GPS", Filter = "Пакет Тарков GPS (*.zip)|*.zip", CheckFileExists = true }) {
                            if (dialog.ShowDialog(this) == DialogResult.OK) StartMaintenance("--install", dialog.FileName);
                        }
                    }
                };
                core.ProcessFailed += delegate { MessageBox.Show(this, "Окно приложения завершилось с ошибкой. Закройте и снова откройте Тарков GPS. Прогресс хранится отдельно.", "Тарков GPS", MessageBoxButtons.OK, MessageBoxIcon.Error); };
                core.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs e) {
                    if (!e.IsSuccess) ShowServiceError();
                };
                core.Navigate(origin + "/");
            } catch (Exception e) {
                Directory.CreateDirectory(Path.Combine(root, "userdata"));
                File.WriteAllText(Path.Combine(root, "userdata", "desktop-error.log"), e.ToString());
                MessageBox.Show(this, "Не удалось открыть окно приложения. Проверьте наличие Microsoft Edge WebView2 Runtime. Подробности: userdata/desktop-error.log", "Тарков GPS", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        };
        FormClosing += delegate { if (!maintenance) StopAutoCapture(); };
    }
    void ShowServiceError() {
        if (serviceError != null) return;
        web.Visible = false;
        var panel = new Panel { Dock = DockStyle.Fill, BackColor = Color.Black };
        serviceError = panel;
        var title = new Label { Text = "Не удалось открыть локальную базу", ForeColor = Color.Gainsboro, Font = new Font("Segoe UI", 18), AutoSize = true, Location = new Point(40, 60) };
        var description = new Label { Text = "Перезапустите службу приложения. Прогресс и настройки остаются на диске.", ForeColor = Color.Silver, AutoSize = false, Size = new Size(650, 60), Location = new Point(40, 110) };
        var retry = new Button { Text = "Перезапустить службу", Location = new Point(40, 190), Size = new Size(230, 40), ForeColor = Color.Gainsboro, BackColor = Color.FromArgb(24,24,24) };
        retry.Click += async delegate {
            retry.Enabled = false;
            try {
                var start = new ProcessStartInfo(Path.Combine(root, "runtime", "node.exe"), "\"" + Path.Combine(root, "server.mjs") + "\" --desktop") { WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true };
                start.EnvironmentVariables["PORT"] = new Uri(origin).Port.ToString();
                Process.Start(start);
                bool ready = await System.Threading.Tasks.Task.Run(delegate {
                    for (int i = 0; i < 60; i++) {
                        try { var request = WebRequest.Create(origin + "/api/health"); request.Timeout = 300; using (var response = request.GetResponse()) return true; } catch {}
                        Thread.Sleep(150);
                    }
                    return false;
                });
                if (ready) { Controls.Remove(panel); panel.Dispose(); serviceError = null; web.Visible = true; web.CoreWebView2.Navigate(origin + "/"); }
                else { description.Text = "Служба не запустилась. Закройте приложение и проверьте целостность папки установки."; retry.Enabled = true; }
            } catch { retry.Enabled = true; }
        };
        panel.Controls.AddRange(new Control[] { title, description, retry });
        Controls.Add(panel); panel.BringToFront();
    }
    bool IsLocal(string value) {
        Uri uri;
        return Uri.TryCreate(value, UriKind.Absolute, out uri) && uri.GetLeftPart(UriPartial.Authority) == origin;
    }
    void OpenExternal(string value) {
        Uri uri;
        if (Uri.TryCreate(value, UriKind.Absolute, out uri) && (uri.Scheme == "https" || uri.Scheme == "http") && !IsLocal(value))
            Process.Start(new ProcessStartInfo(value) { UseShellExecute = true });
    }
    void StopAutoCapture() {
        try {
            var request = (HttpWebRequest)WebRequest.Create(origin + "/api/gps/auto");
            request.Method = "POST"; request.Timeout = 1000; request.ContentType = "application/json"; request.Headers["Origin"] = origin;
            byte[] body = Encoding.UTF8.GetBytes("{\"enabled\":false}");
            request.ContentLength = body.Length;
            using (var stream = request.GetRequestStream()) stream.Write(body, 0, body.Length);
            using (var response = request.GetResponse()) {}
        } catch {}
    }
    void StartMaintenance(string operation, string package) {
        StopAutoCapture();
        string args = operation + " \"" + root + "\"" + (package == null ? "" : " \"" + package + "\"");
        string temporary = Path.Combine(Path.GetTempPath(), "TarkovOffline-maint-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temporary);
        string executable = Path.Combine(temporary, "TarkovMaintenance.exe");
        File.Copy(Path.Combine(root, "runtime", "TarkovMaintenance.exe"), executable);
        Process.Start(new ProcessStartInfo(executable, args) { WorkingDirectory = root, UseShellExecute = false });
        maintenance = true;
        Close();
    }
}
