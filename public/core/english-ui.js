// Совместимость со старым интерфейсом: редактируйте значения ru/en в public/locales.
import { interfaceTexts } from "../locales/index.js";
export const englishUi = Object.fromEntries(
  Object.entries(interfaceTexts).map(([source, item]) => [
    source.trim(),
    item.en.trim(),
  ]),
);
