using System;
using System.IO;
using System.Diagnostics;
using System.Net;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Windows.Forms;

class Launcher {
    const string AppTitle = "EFT GPS";
    delegate bool EnumWindowCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowCallback callback, IntPtr parameter);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);

    [STAThread] static void Main() {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string url = "http://127.0.0.1:38471";
        NativeText.English=NativeText.Preferred(root);
        try {
            PreparePortable(root);
            bool running = Healthy(url);
            if (!running) {
                var start = new ProcessStartInfo(Path.Combine(root, "runtime", "node.exe"), "\"" + Path.Combine(root, "server.mjs") + "\" --desktop");
                start.WorkingDirectory = root;
                start.EnvironmentVariables["TARKOV_DOCUMENTS_PATH"] = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                start.UseShellExecute = false;
                start.CreateNoWindow = true;
                Process.Start(start);
                for (int i = 0; i < 80 && !running; i++) { Thread.Sleep(150); running = Healthy(url); }
            }
            if (!running) throw new Exception("Не удалось запустить локальное приложение. Проверьте, что архив распакован полностью, а порт 38471 свободен.");
            Process.Start(new ProcessStartInfo(Path.Combine(root, "runtime", "TarkovDesktopHost.exe")) { WorkingDirectory = root, UseShellExecute = false });
        } catch (Exception e) { MessageBox.Show(NativeText.T(e.Message), "EFT GPS", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    static void PreparePortable(string root) {
        string script=Path.Combine(root,"scripts","prepare-portable.mjs");
        if(!File.Exists(script)) return;
        var start=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),"\""+script+"\" --ensure-runtime") {
            WorkingDirectory=root,UseShellExecute=false,CreateNoWindow=true,RedirectStandardError=true
        };
        using(var process=Process.Start(start)) {
            string error=process.StandardError.ReadToEnd();
            process.WaitForExit();
            if(process.ExitCode!=0) throw new Exception(String.IsNullOrWhiteSpace(error) ? "Не удалось подготовить приложение. Распакуйте архив полностью." : error.Trim());
        }
    }

    static bool Healthy(string url) {
        try {
            var request = WebRequest.Create(url + "/api/health");
            request.Timeout = 400;
            using (var response = request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream())) return reader.ReadToEnd().Contains("TarkovOffline");
        } catch { return false; }
    }
}
