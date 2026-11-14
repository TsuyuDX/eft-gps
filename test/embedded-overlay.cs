using System;
using System.IO;
using System.Collections.Generic;
using System.Reflection;
using System.Windows.Forms;
class EmbeddedOverlayTest {
    static void Check(bool value,string message){if(!value)throw new Exception(message);}
    [STAThread] static void Main(string[] args){
        Application.EnableVisualStyles();string root=Path.GetFullPath(args[0]);
        using(var overlay=new OverlayHost(root,"http://127.0.0.1:38571",true,true)){
            Check(!overlay.ShowInTaskbar,"Embedded renderer must not create a taskbar entry");
            Check(overlay.Opacity<0.02 && overlay.Location.X<0,"Renderer settings window must stay off-screen");
            var settings=new Dictionary<string,object>{{"size",34},{"position","bottom-right"},{"opacity",63},{"hotkey","F8"},{"refreshMs",2000},{"map","night-factory"},{"mode","pve"},{"follow",true}};
            overlay.ApplySettings(settings).GetAwaiter().GetResult();
            var flags=BindingFlags.NonPublic|BindingFlags.Instance;
            Check((int)typeof(OverlayHost).GetField("overlaySize",flags).GetValue(overlay)==34,"Compact size not applied");
            Check((string)typeof(OverlayHost).GetField("overlayPosition",flags).GetValue(overlay)=="bottom-right","Position not applied");
            Check(!Convert.ToBoolean(overlay.RuntimeState()["running"]),"Disabled renderer must not report a ready map");
            Check(!Convert.ToBoolean(overlay.RuntimeState()["hotkeyRegistered"]),"Constructing settings must not register a global hotkey");
        }
        Console.WriteLine("Embedded Overlay checks passed: no taskbar entry, no standalone process, validated settings, safe disposal.");
    }
}
