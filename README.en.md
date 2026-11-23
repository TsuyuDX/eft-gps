> [!NOTE]
> Интерфейс приложения частично создан с использованием искусственного интеллекта.
> Application interface partially created with the assistance of AI.

# T_S_U_Y_U EFT GPS — installation guide

**[Download the Windows installer](https://github.com/TsuyuDX/eft-gps/releases/latest/download/EFT-GPS-Setup.exe)**

**[Read the complete English installation guide](README.md#en)** · [Инструкция на русском](README.md#ru)

1. Download **EFT-GPS-Setup.exe** using the link above. You do not need Code → Download ZIP or the Source code archives.
2. Open it and click **Download and install**. The downloader retrieves and verifies the application files, then opens setup.
3. Click **Browse…** and choose a parent folder. Setup creates an **EFT GPS** subfolder. Select **Create a desktop shortcut** if wanted.
4. Click **Next → Install**, wait for **100%**, then click **Open application**.
5. Choose **English** in the application and follow the first-run introduction.

For a manual update, close the app and select its existing folder containing **EFT GPS.exe**. Your settings and progress are preserved. From 1.10.0, update checks offer release notes and **Update / Later**. Downloading begins only after Update; setup detects the existing folder. Earlier versions may download automatically.

See the complete guide for screenshots, GPS setup, requirements and troubleshooting.

For Windows security messages, read [Windows warnings](README.md#windows-warnings): the installer is unsigned, but a detected threat should be investigated rather than ignored.


Screenshot-based image tuning: [Graphics and colour correction](GRAPHICS.md#english).


Events, seasons, promo codes and sources: [how information updates work](GAME-INFORMATION.md#english).

## Development branch 1.13: maps and offline content

The dark green workspace adapts to small windows. Open **Settings → Training** for an interactive tour. **Map style** switches between a diagram and an attributed overhead game render where available; these are not satellite photographs. Verified overhead views are not available for Lighthouse, Streets and Terminal yet.

Maps, markers, summary lists and screenshot GPS remain bundled. Detailed cards and additional images are downloaded on demand and cached with SHA-256 validation. Before going offline, open **Settings → Data → Download everything for offline use** and wait for completion. Existing cached files are reused and remain available after network failures.

Interchange (`shopping_mall`), Reserve and event scene aliases have been fixed. Actual coordinate filenames and log associations were checked on six maps, not every in-raid position. The graphics preview includes gameplay captures from six locations; import your own PNG/JPEG for the others. Preview values are not NVIDIA/PostFX scales.
