// ТЕКСТЫ: Новости
// Меняйте только ru/en. Ключ слева — постоянный идентификатор исходной фразы.
// Переменные __V0__ и переносы строк сохраняйте. Пишите обычный текст без HTML.
export const news = {
  // Где: public/features/news.js
  Официально: { ru: "Официально", en: "Official" },
  // Где: public/features/news.js
  "Сохранён язык первоисточника. Это краткое превью публикации; полный текст доступен по ссылке. Активность событий и активация промокодов проверяются отдельно.":
    {
      ru: "Сохранён язык первоисточника. Это краткое превью публикации; полный текст доступен по ссылке. Активность событий и активация промокодов проверяются отдельно.",
      en: "Source language is preserved. This is a short publication preview; read the original for full details. Event activity and code redemption are checked separately.",
    },
  // Где: public/features/news.js
  "Иллюстрация из публикации разработчиков": {
    ru: "Иллюстрация из публикации разработчиков",
    en: "Artwork from the developer’s publication",
  },
};

// Новости приложения 1.12.0. Ключи сохраняйте; ru/en можно редактировать.
Object.assign(news, {
  "EFT GPS 1.12: встроенный Overlay и надёжное сохранение": {
    "ru": "EFT GPS 1.12: встроенный Overlay и надёжное сохранение",
    "en": "EFT GPS 1.12: integrated Overlay and reliable saves"
  },
  "Карта поверх игры настраивается внутри приложения. Исправлены поиск, сохранение профиля и отмена загрузки обновлений.": {
    "ru": "Карта поверх игры настраивается внутри приложения. Исправлены поиск, сохранение профиля и отмена загрузки обновлений.",
    "en": "Configure the in-game map overlay inside EFT GPS. Includes search, profile saving and download cancellation fixes."
  },
  "Откройте Настройки → Overlay. Выберите большую или компактную карту, положение, размер, прозрачность и горячую клавишу. Функция Beta выключена по умолчанию; отдельное приложение больше не требуется. Используйте оконный режим игры без рамки.": {
    "ru": "Откройте Настройки → Overlay. Выберите большую или компактную карту, положение, размер, прозрачность и горячую клавишу. Функция Beta выключена по умолчанию; отдельное приложение больше не требуется. Используйте оконный режим игры без рамки.",
    "en": "Open Settings → Overlay. Choose a large or compact map, position, size, opacity and hotkey. Beta is off by default and no separate application is required. Use borderless windowed mode."
  },
  "Добавлено восстановление повреждённого профиля из резервной копии. Исправлены быстрые переходы между разделами, смена режима, повторяющиеся новости и отображение времени GPS. Скачивание обновления можно отменить и повторить; установка остаётся вашим выбором.": {
    "ru": "Добавлено восстановление повреждённого профиля из резервной копии. Исправлены быстрые переходы между разделами, смена режима, повторяющиеся новости и отображение времени GPS. Скачивание обновления можно отменить и повторить; установка остаётся вашим выбором.",
    "en": "Corrupt profiles can recover from a valid backup. Fixed fast navigation, mode switching, duplicate news and GPS fix ages. Update downloads can be cancelled and retried; installation remains your choice."
  },
  "Проверены автоматизированные тесты, установщик, загрузчик и окно Overlay. Совместимость с настоящим рейдом и античитом отдельно не подтверждена. Новые неподтверждённые точки сезонных заданий не добавлялись автоматически.": {
    "ru": "Проверены автоматизированные тесты, установщик, загрузчик и окно Overlay. Совместимость с настоящим рейдом и античитом отдельно не подтверждена. Новые неподтверждённые точки сезонных заданий не добавлялись автоматически.",
    "en": "Automated tests, setup, downloader and Overlay window checks passed. Live-raid and anti-cheat compatibility remain unverified. New unconfirmed seasonal quest points were not automatically added."
  }
});

Object.assign(news, {
  "Проверены автоматизированные тесты, установщик, загрузчик и окно Overlay. Совместимость с настоящим рейдом и античитом отдельно не подтверждена. Добавлены 18 сезонных заданий на русском и английском с офлайн-иллюстрациями. Точки заданий сверены со справочником, дубли камер исправлены.": {
    "ru": "Проверены автоматизированные тесты, установщик, загрузчик и окно Overlay. Совместимость с настоящим рейдом и античитом отдельно не подтверждена. Добавлены 18 сезонных заданий на русском и английском с офлайн-иллюстрациями. Точки заданий сверены со справочником, дубли камер исправлены.",
    "en": "Automated tests, setup, downloader and Overlay window checks passed. Live-raid and anti-cheat compatibility remain unverified. Added 18 bilingual event tasks with offline illustrations. Quest points match the reference and duplicate cameras were corrected."
  }
});
