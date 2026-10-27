import { confirmAction, toast } from "./ui.js";
export function bindDesktopActions(root) {
  const bridge = window.chrome?.webview;
  root.querySelectorAll("[data-desktop-command]").forEach((button) => {
    button.disabled = !bridge;
    if (!bridge) button.title = "Доступно в отдельном окне Тарков GPS";
    button.onclick = async () => {
      const command = button.dataset.desktopCommand;
      if (
        command === "update-data" &&
        !(await confirmAction(
          "Обновить базу?",
          "Нужен интернет. Окно приложения закроется, автосъёмка GPS остановится. Загрузчик проверит новую базу и сохранит предыдущий снимок. Прогресс останется на месте.",
          "Перейти к обновлению",
        ))
      )
        return;
      if (
        command === "install-update" &&
        !(await confirmAction(
          "Обновить приложение",
          "Выберите ZIP-пакет Тарков GPS. Окно закроется, автосъёмка остановится. Состав пакета проверяется перед установкой; прогресс и настройки GPS сохраняются.",
          "Выбрать пакет",
        ))
      )
        return;
      try {
        bridge?.postMessage(command);
      } catch {
        toast("Не удалось открыть службу обновления");
      }
    };
  });
}
