# GitHub download installer

The standalone WinForms downloader retrieves the full offline installer for one pinned release. Its embedded setup-parts.json contains the exact sizes and SHA-256 checksums. No GitHub credentials are included or required by the download installer.

Build from the project root using PowerShell 7:

```powershell
./tools/distribution/build.ps1 -PartsManifest ./work/release-assets/1.7.0/setup-parts.json -Output ./work/release-assets/1.7.0/EFT-GPS-Setup.exe
```

The downloader reuses the native black/sand controls, icons and translations in scripts/. Windows determines the initial language; RU/EN buttons switch it. It verifies each part and the final EXE before opening setup. Completed verified parts can be reused after interruption. An optional checkbox removes the temporary setup file after the setup window closes.

The build runs embedded tests for copying, corruption, truncation, cancellation, verified cache reuse and unsafe manifest names. Publish the helper and its SHA-256 sidecar in the same GitHub release as the referenced parts. The release must be public before anonymous downloads can succeed.

This distribution tool is separate from the installed app. It needs internet for its download; the resulting app and the complete installer package work offline.
