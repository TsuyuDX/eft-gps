import { language } from "../core/localization.js";
import { modal, esc } from "../core/ui.js";
import { supportLinks, supportCommunity, supportUrl } from "../core/support-config.js";
const L = (ru,en) => language() === "en" ? en : ru;

function publicNames(entries) {
  return [...new Set((Array.isArray(entries) ? entries : [])
    .filter(entry => entry?.verified === true && entry?.consent === true && typeof entry.nickname === "string")
    .map(entry => entry.nickname.trim().slice(0,48)).filter(Boolean))];
}

export function openSupport(links = supportLinks, community = supportCommunity) {
  const discord = supportUrl("discord",links.discord ?? "");
  const goal = Number.isSafeInteger(community.goal) && community.goal > 0 ? community.goal : null;
  const count = Number.isSafeInteger(community.confirmedSponsors) && community.confirmedSponsors >= 0 ? community.confirmedSponsors : 0;
  const credits = (kind,title) => {
    const names = publicNames(community[kind]);
    return `<section class="support-credits" data-support-credits="${kind}"><h3><span aria-hidden="true">${kind === "boosters" ? "ϟ" : "◇"}</span> ${title}</h3><div class="support-nicknames">${names.length ? names.map(name => `<span class="support-nickname">${esc(name)}</span>`).join("") : `<p class="support-empty">${L("Здесь появятся подтверждённые участники, разрешившие показать свой никнейм.", "Verified supporters who choose to share their nickname will appear here.")}</p>`}</div></section>`;
  };
  modal(`<section class="support-panel" aria-labelledby="support-title" data-no-translate>
    <header class="support-hero"><div class="support-heart" aria-hidden="true">♥</div><div class="eyebrow">T_S_U_Y_U / EFT GPS</div><h2 id="support-title">${L("Поддержите развитие EFT GPS!", "Support EFT GPS development!")}</h2><p>${L("Нравится приложение? Разовый донат или подписка помогают разработке. Буст Discord — ещё один способ помочь нашему сообществу.", "Enjoy the app? A one-time donation or membership helps fund development. A Discord boost is another way to support our community.")}</p></header>
    ${goal ? `<section class="support-goal"><h3>${L("Цель поддержки проекта", "Project supporter goal")}</h3><progress max="${goal}" value="${Math.min(count,goal)}" aria-label="${L("Цель поддержки", "Supporter goal")}"></progress><p>${count} ${L("из", "of")} ${goal} ${L("подтверждённых спонсоров", "confirmed supporters")}</p></section>` : `<div class="support-free">${L("Приложение остаётся бесплатным. Любой способ поддержки — только по вашему желанию.", "The app stays free. Every form of support is entirely optional.")}</div>`}
    <section class="support-benefits" aria-labelledby="support-benefits-title"><div class="support-benefits-heading"><h3 id="support-benefits-title">${L("Бонусы поддержки", "Supporter perks")}</h3><small>${L("По мере запуска бонусов и сервера", "As perks and the server launch")}</small></div><ul>${[
      [L("Ранний доступ к тестовым сборкам", "Early access to test builds"),L("Обновления до публичного стабильного выпуска.", "Try updates before the public stable release.")],
      [L("Роль поддержки в Discord", "A supporter role in Discord"),L("Для подтверждённых подписчиков и бустеров сервера.", "For verified members and server boosters.")],
      [L("Обсуждение новых функций", "Discuss upcoming features"),L("Делитесь идеями и отзывами о развитии приложения.", "Share ideas and feedback on the app’s development.")],
      [L("Ваш никнейм в благодарностях", "Your nickname in the credits"),L("Только с вашего согласия — анонимная поддержка тоже возможна.", "Only with your permission; anonymous support is welcome too.")],
    ].map(([title,description]) => `<li><span aria-hidden="true">✓</span><div><strong>${title}</strong><p>${description}</p></div></li>`).join("")}</ul><p class="support-benefits-note">${L("Тестовые сборки могут содержать ошибки; стабильные обновления останутся бесплатными для всех.", "Test builds may contain bugs; stable updates will remain free for everyone.")}</p></section>
    ${credits("sponsors",L("Спонсоры проекта", "Project supporters"))}${credits("boosters",L("Бустеры Discord", "Discord boosters"))}
    <section class="support-actions" aria-label="${L("Способы поддержки", "Ways to support")}"><h3>${L("Поддержать разработку", "Support development")}</h3><div class="support-options">${[
      ["boostySubscription",L("Оформить подписку", "Become a member"),L("Boosty · ежемесячная оплата", "Boosty · monthly payment")],
      ["boosty",L("Разовый донат", "One-time donation"),L("Boosty · без подписки", "Boosty · no subscription")], ["kofi","Ko-fi",L("США и Европа", "US & Europe")],
    ].map(([id,name,region]) => {
      const url=supportUrl(id,links[id] ?? "");const content=`<strong>${name}${url ? " ↗" : ""}</strong><small>${region}${url ? "" : " · "+L("Скоро", "Coming soon")}</small>`;
      return `<div class="support-option" data-support-provider="${id}">${url ? `<a class="button primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${content}</a>` : `<button disabled aria-disabled="true">${content}</button>`}</div>`;
    }).join("")}</div><div class="support-or"><span>${L("или поддержите сообщество", "or support the community")}</span></div>
    ${discord ? `<a class="button support-discord" href="${esc(discord)}" target="_blank" rel="noopener noreferrer">ϟ ${L("Бустнуть Discord", "Boost our Discord")} ↗</a>` : `<button class="support-discord" disabled aria-disabled="true">ϟ ${L("Бустнуть Discord · скоро", "Boost our Discord · coming soon")}</button>`}
    <p class="support-discord-note">${L("Буст помогает серверу Discord; поддержка через Boosty и Ko-fi — разработке приложения. Буст оформляется в самом Discord после входа на сервер.", "Boosts help the Discord server; Boosty and Ko-fi help fund the app. Boosting is managed in Discord after joining the server.")}</p></section>
    <details class="support-explainer"><summary>${L("Как это работает", "How it works")}</summary><p>${L("Сервисы открываются во внешнем браузере и требуют интернета. Сумму и разовый платёж или подписку вы выбираете на стороне сервиса. Подписка предполагает регулярные списания; условия и отмена доступны на выбранной площадке. EFT GPS не запрашивает данные карты и не хранит платёжные реквизиты.", "Providers open in your external browser and require internet. Choose an amount and one-time payment or membership on the provider’s page. Memberships involve recurring payments; terms and cancellation are managed there. EFT GPS does not request card details or store payment credentials.")}</p></details>
    ${["boosty","boostySubscription","kofi","discord"].some(id => supportUrl(id,links[id] ?? "")) ? "" : `<p class="support-pending">${L("Страницы автора и сервер ещё не подключены. Кнопки станут доступны после настройки и проверки.", "The creator’s pages and server are not connected yet. Buttons will become available after setup and verification.")}</p>`}
  </section>`);
  const dialog=document.querySelector("#modal");dialog.classList.add("support-dialog");dialog.addEventListener("close",()=>dialog.classList.remove("support-dialog"),{once:true});
}
