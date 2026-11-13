# Диагностика EFT GPS / Diagnostics

Диагностика **отключена по умолчанию**. Включение: Настройки → Диагностика → явное согласие.

Сохраняются версия приложения, семейство/версия ОС, категория и код ошибки, округлённая длительность операции и время с точностью до минуты. Разрешён закрытый перечень категорий и кодов: произвольные сообщения, адреса и стеки исключены.

Не собираются скриншоты, координаты GPS, игровые заметки, имена пользователей, пути к файлам, IP-адреса, пароли, токены и платёжные данные. Идентификатор устройства не создаётся.

Отчёт находится в приватной папке `userdata/diagnostics`. Максимум 300 событий за 7 дней; повторные одинаковые события ограничены. Отчёт можно просмотреть и удалить. Отключение сбора удаляет накопленный отчёт, а настройки согласия сохраняются, чтобы не включать сбор повторно автоматически.

В загрузчике установщика есть отдельное необязательное согласие на сохранение технической ошибки: версия, этап, код и длительность. Один небольшой локальный файл находится в кеше установщика соответствующей версии; он не отправляется и удаляется пользователем вместе с этим кешем.

## Отправка пока не подключена

В текущем выпуске **нет автоматической отправки, сервера приёма, аналитического SDK или публикации отчётов в GitHub**. В настройках это указано явно. Приватный сервис настраивается отдельно. Перед его подключением нужно указать получателя, адрес сервиса и условия хранения, изменить версию политики и запросить отдельное согласие на передачу. Текущее согласие касается только локального хранения.

Служебные результаты тестов в `work` и пользовательские отчёты в `userdata` исключены из Git.

## English

Diagnostics are optional and off by default. Explicit consent enables local storage of app/OS versions, allowlisted error categories/codes, rounded operation durations and minute-resolution timestamps. No screenshots, GPS coordinates, personal notes, names, paths, IP addresses, credentials, payment details or device identifiers are collected.

Reports are limited to 300 events over seven days and can be inspected/deleted. Withdrawing consent deletes the report. The installer has a separate optional local error report. **Automatic upload is not configured.** Connecting a private collection service will require a named recipient, updated policy and separate transmission consent. No diagnostics are posted to GitHub.
