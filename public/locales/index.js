import { diagnosticTexts } from "./diagnostics.js";
import { customTexts } from "./custom.js";
import { markup } from "./markup.js";
import { interfaceMessages } from "./interface.js";
import { app } from "./app.js";
import { app_update } from "./app-update.js";
import { connectivity } from "./connectivity.js";
import { event_content_client } from "./event-content-client.js";
import { global_search } from "./global-search.js";
import { map_colour } from "./map-colour.js";
import { overlay_client } from "./overlay-client.js";
import { game_info } from "./game-info.js";
import { graphics } from "./graphics.js";
import { help } from "./help.js";
import { map_gps } from "./map-gps.js";
import { map_search } from "./map-search.js";
import { news } from "./news.js";
import { quest_detail } from "./quest-detail.js";
import { support } from "./support.js";
import { other_interface } from "./other-interface.js";

// Единый словарь для существующей системы локализации. Последовательность разделов стабильна.
export const interfaceTexts = Object.assign(
  Object.create(null),
  interfaceMessages,
  app,
  app_update,
  connectivity,
  event_content_client,
  global_search,
  map_colour,
  overlay_client,
  game_info,
  graphics,
  help,
  map_gps,
  map_search,
  news,
  quest_detail,
  support,
  other_interface,
  markup,
  diagnosticTexts,
  customTexts,
);

// Подписи в DOM иногда приходят с отступами. Оба варианта используют одну запись.
for (const [source, item] of Object.entries(interfaceTexts)) {
  if (!Object.hasOwn(interfaceTexts, source.trim()))
    interfaceTexts[source.trim()] = item;
}
