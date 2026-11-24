// Current-user startup only; no elevation, shell interpolation or game changes.
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export async function startupSetting(root, enabled) {
  if (process.platform !== "win32") throw Error("Доступно только в Windows");
  const value = '"' + path.join(root, "EFT GPS.exe") + '"';
  const literal = (x) => "'" + x.replaceAll("'", "''") + "'";
  const key = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
  const script =
    `$ErrorActionPreference='Stop';$p=${literal(key)};$v=${literal(value)};` +
    (typeof enabled === "boolean"
      ? enabled
        ? "New-Item -Path $p -Force | Out-Null;Set-ItemProperty -Path $p -Name 'EFTGPS' -Value $v;"
        : "if((Get-ItemProperty -LiteralPath $p -Name 'EFTGPS' -ErrorAction SilentlyContinue).EFTGPS -eq $v){Remove-ItemProperty -LiteralPath $p -Name 'EFTGPS'};"
      : "") +
    "$x=(Get-ItemProperty -LiteralPath $p -Name 'EFTGPS' -ErrorAction SilentlyContinue).EFTGPS;[pscustomobject]@{enabled=($x -eq $v)} | ConvertTo-Json -Compress";
  const exe = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const result = await run(
    exe,
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ],
    { windowsHide: true, timeout: 10000, maxBuffer: 8192 },
  );
  return JSON.parse(result.stdout.trim());
}
