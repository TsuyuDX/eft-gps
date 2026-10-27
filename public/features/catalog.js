import { extraPropertyLabels, propertyValue } from "../core/item-properties.js";
import { db, detail, asset, localHref, itemBySlug } from "../core/data.js";
import { current, toggleFavorite, inventory } from "../core/state.js";
import {
  esc,
  money,
  img,
  heading,
  pagination,
  bindPages,
  rich,
  toast,
} from "../core/ui.js";
export function itemRows(items) {
  return items
    .map(
      (x) =>
        `<tr><td><button class="star ${current().favorites.includes(x.id) ? "selected" : ""}" data-fav="${x.id}" aria-label="В избранное">★</button></td><td><a class="item-name" href="#/item/${db.mode}/${x.normalizedName}">${img(x.iconLink, x.name)}<span>${esc(x.name)}</span></a></td><td>${money(x.trades?.flea?.priceRUB)}</td><td>${money(x.trades?.bestBuyVendor?.priceRUB)}<small class="muted block">${esc(db.lookup.traders?.[x.trades?.bestBuyVendor?.vendor?.normalizedName]?.name || "")}</small></td><td>${money(x.trades?.bestSellVendor?.priceRUB)}</td><td>${x.width || 1} × ${x.height || 1}</td></tr>`,
    )
    .join("");
}
export function bindFavorites(root) {
  root.querySelectorAll("[data-fav]").forEach(
    (b) =>
      (b.onclick = () => {
        toggleFavorite(b.dataset.fav);
        b.classList.toggle("selected");
      }),
  );
}
export function renderCatalog(root, initial = "") {
  root.innerHTML =
    heading(
      "Предметы",
      `${db.items.length.toLocaleString("ru-RU")} предметов · цены из локального снимка`,
    ) +
    `<div class="toolbar"><input id="item-search" type="search" placeholder="Искать по названию" value="${esc(initial)}"><select id="item-category" aria-label="Категория"><option value="">Все категории</option>${db.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select><select id="item-sort" aria-label="Сортировка"><option value="name">По названию</option><option value="price-desc">Сначала дорогие</option><option value="price-asc">Сначала дешёвые</option><option value="slot">Цена за слот</option></select><label class="check"><input type="checkbox" id="fav-only"> Избранное</label></div><div id="catalog-results"></div>`;
  let page = 0;
  function draw() {
    const q = root.querySelector("#item-search").value.trim().toLowerCase(),
      cat = root.querySelector("#item-category").value,
      fav = root.querySelector("#fav-only").checked,
      sort = root.querySelector("#item-sort").value;
    let list = db.items.filter(
      (x) =>
        (!q ||
          x.name.toLowerCase().includes(q) ||
          x.normalizedName.includes(q)) &&
        (!cat || x.handbookCategoryIds?.includes(cat)) &&
        (!fav || current().favorites.includes(x.id)),
    );
    list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "ru")
        : sort === "slot"
          ? (b.trades?.flea?.priceRUB || 0) /
              ((b.width || 1) * (b.height || 1)) -
            (a.trades?.flea?.priceRUB || 0) / ((a.width || 1) * (a.height || 1))
          : ((a.trades?.flea?.priceRUB || 0) -
              (b.trades?.flea?.priceRUB || 0)) *
            (sort === "price-desc" ? -1 : 1),
    );
    const box = root.querySelector("#catalog-results");
    box.innerHTML = list.length
      ? `<div class="table-wrap"><table><thead><tr><th>★</th><th>Название</th><th>Барахолка</th><th>Купить у торговца, ₽</th><th>Продать торговцу, ₽</th><th>Размер</th></tr></thead><tbody>${itemRows(list.slice(page * 50, page * 50 + 50))}</tbody></table></div>${pagination(list.length, page, 50)}`
      : `<div class="empty">Ничего не найдено. Измените поиск или фильтры.</div>`;
    bindFavorites(box);
    bindPages(box, (p) => {
      page = p;
      draw();
      root.scrollIntoView({ behavior: "smooth" });
    });
  }
  root.querySelectorAll("input,select").forEach((e) =>
    e.addEventListener(
      e.tagName === "INPUT" && e.type === "search" ? "input" : "change",
      () => {
        page = 0;
        draw();
      },
    ),
  );
  draw();
}
const propLabels = {
  weight: "Вес, кг",
  armorClass: "Класс брони",
  durability: "Прочность",
  damage: "Урон",
  penetrationPower: "Пробитие",
  armorDamage: "Урон броне, %",
  caliber: "Калибр",
  initialSpeed: "Скорость, м/с",
  recoilVertical: "Вертикальная отдача",
  recoilHorizontal: "Горизонтальная отдача",
  ergonomics: "Эргономика",
  fireRate: "Темп стрельбы",
  hitpoints: "Запас лечения",
  useTime: "Время применения, с",
  capacity: "Вместимость",
  maxDurability: "Макс. прочность",
  energy: "Энергия",
  hydration: "Гидратация",
  speedPenalty: "Штраф скорости",
  stackMaxSize: "Макс. в стопке",
  accuracyModifier: "Модификатор точности",
  slots: "Слоты",
  uses: "Использований",
  recoilModifier: "Модификатор отдачи",
};
function recipe(r) {
  return `<div class="recipe"><div>${esc(r.trader?.name || db.lookup.hideout?.[r.station?.normalizedName]?.name || r.station?.name || "Убежище")} · уровень ${r.level || r.station?.level || 1}${r.duration ? ` · ${esc(r.duration)}` : ""}</div><div class="row wrap">${(r.requiredItems || []).map((e) => `<a href="#/item/${db.mode}/${e.item?.normalizedName}">${esc(e.item?.shortName || e.item?.name)} × ${e.count}</a>`).join(" + ")} <b>→</b> ${(r.rewardItems || []).map((e) => `<a href="#/item/${db.mode}/${e.item?.normalizedName}">${esc(e.item?.shortName || e.item?.name)} × ${e.count}</a>`).join(" + ")}</div>${r.taskUnlock ? `<a href="#/quest/${db.mode}/${r.taskUnlock.normalizedName}">Открывается заданием: ${esc(r.taskUnlock.name)}</a>` : ""}</div>`;
}
export async function renderItem(root, slug) {
  const x = await detail("items", slug),
    live = itemBySlug(slug),
    trades = live?.trades || x.trades;
  root.innerHTML =
    heading(
      x.name,
      "Характеристики, цены, обмены и производство",
      `<button class="star ${current().favorites.includes(x.id) ? "selected" : ""}" data-fav="${x.id}">★ В избранное</button>`,
    ) +
    `<div class="detail-grid"><section class="panel item-hero">${img(x.iconLink, x.name)}<div class="muted">${x.width} × ${x.height} · ${x.properties?.weight ?? "—"} кг</div><label>Собрано <input id="item-count" type="number" min="0" value="${current().inventory[x.id] || 0}"></label><a href="#/items-tracker/${db.mode}">Открыть трекер →</a></section><section><p class="description">${esc(x.description)}</p><div class="stats"><div class="stat"><span>Барахолка</span><strong>${money(trades?.flea?.priceRUB)}</strong></div><div class="stat"><span>Купить у торговца</span><strong>${money(trades?.bestBuyVendor?.priceRUB)}</strong></div><div class="stat"><span>Продать торговцу</span><strong>${money(trades?.bestSellVendor?.priceRUB)}</strong></div><div class="stat"><span>Средняя за 24 часа</span><strong>${money(trades?.avg24hPrice?.priceRUB)}</strong></div></div><p class="muted small">Снимок цен: ${new Date(db.manifest.savedAt).toLocaleDateString("ru-RU")}. Свежие цены появляются после обновления базы.</p><h2>Характеристики</h2><div class="properties">${
      Object.entries(x.properties || {})
        .filter(
          ([k, v]) =>
            !["propertiesType"].includes(k) &&
            v !== null &&
            typeof v !== "object",
        )
        .map(
          ([k, v]) =>
            `<div><span class="muted">${esc(extraPropertyLabels[k] || propLabels[k] || k)}</span><strong>${esc(propertyValue(k, v))}</strong></div>`,
        )
        .join("") || '<p class="muted">Дополнительных характеристик нет.</p>'
    }</div></section></div><section class="panel"><h2>Обмены</h2>${[...(x.barters?.bartersFor || []), ...(x.barters?.bartersUsing || [])].map(recipe).join("") || '<p class="muted">Обменов в базе нет.</p>'}</section><section class="panel"><h2>Производство</h2>${[...(x.crafts?.craftsFor || []), ...(x.crafts?.craftsUsing || [])].map(recipe).join("") || '<p class="muted">Рецептов в базе нет.</p>'}</section><section class="panel"><h2>Нужен для заданий</h2>${(x.questsFor || []).map((q) => '<p><a href="#/quest/' + db.mode + "/" + q.normalizedName + '">' + esc(q.name) + "</a> × " + q.count + "</p>").join("") || '<span class="muted">Нет требований в снимке.</span>'}</section>`;
  bindFavorites(root);
  root.querySelector("#item-count").onchange = (e) => {
    inventory(x.id, e.target.value);
    toast("Количество сохранено");
  };
}
