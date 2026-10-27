using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Windows.Forms;
public static class NativeText {
 public const string Brand="T_S_U_Y_U EFT GPS";
 public const string Version="1.7.2";
 public static bool English;
 static readonly Dictionary<string,string> words=Load();
 class Record {public string Source,Output;}
 static readonly Dictionary<Control,Record> originals=new Dictionary<Control,Record>();
 static Dictionary<string,string> Load(){using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("native.en.json")){if(stream==null)return new Dictionary<string,string>();using(var reader=new StreamReader(stream,Encoding.UTF8))return new JavaScriptSerializer().Deserialize<Dictionary<string,string>>(reader.ReadToEnd());}}
 public static bool Preferred(string root){try{var json=new JavaScriptSerializer();var saved=(Dictionary<string,object>)json.DeserializeObject(File.ReadAllText(Path.Combine(root,"userdata","window-settings.json")));var values=(Dictionary<string,object>)saved["values"];var locale=(Dictionary<string,object>)json.DeserializeObject((string)values["tarkov-locale-v1"]);return (string)locale["language"]=="en";}catch{return CultureInfo.CurrentUICulture.TwoLetterISOLanguageName!="ru";}}
 public static string T(string value){if(!English||String.IsNullOrEmpty(value))return value;if(value.IndexOf('\n')>=0){var lines=value.Split('\n');for(int i=0;i<lines.Length;i++)lines[i]=T(lines[i].TrimEnd('\r'));return String.Join("\r\n",lines);}string translated;if(words.TryGetValue(value.Trim(),out translated))return value.Replace(value.Trim(),translated);string result=value;var keys=new List<string>(words.Keys);keys.Sort((a,b)=>b.Length.CompareTo(a.Length));foreach(var key in keys){if(result.StartsWith(key,StringComparison.Ordinal)){result=words[key]+result.Substring(key.Length);break;}}foreach(var key in keys){if(result.EndsWith(key,StringComparison.Ordinal)){result=result.Substring(0,result.Length-key.Length)+words[key];break;}}return result;}
 public static void Apply(Control control){
  if(control.GetType().Name=="DarkLog"){control.GetType().GetMethod("RefreshLanguage").Invoke(control,null);return;}
  if(!(control is TextBoxBase)&&!(control is ComboBox)){
   Record record;if(!originals.TryGetValue(control,out record)){record=new Record{Source=control.Text,Output=control.Text};originals[control]=record;}
   if(control.Text!=record.Output)record.Source=control.Text;
   record.Output=T(record.Source);if(control is Form && record.Output.Contains("EFT GPS") && !record.Output.Contains("T_S_U_Y_U"))record.Output=record.Output.Replace("EFT GPS",Brand+" "+Version);if(control.Text!=record.Output)control.Text=record.Output;
  }
  foreach(Control child in control.Controls)Apply(child);
 }
 public static void Select(bool english){English=english;foreach(Form form in Application.OpenForms)Apply(form);}
}
