import { language } from "../core/localization.js";
import { modal, esc } from "../core/ui.js";
import { supportLinks, supportUrl } from "../core/support-config.js";
const L = (ru,en) => language() === "en" ? en : ru;

export function openSupport(links = supportLinks) {
  const providers = [
    {id:"boosty", name:"Boosty", symbol:"B", region:L("СНГ", "CIS"),
      description:L("Разовая поддержка и подписка на развитие проекта.", "One-time support and a membership to help fund development.")},
    {id:"kofi", name:"Ko-fi", symbol:"K", region:L("США и Европа", "US & Europe"),
      description:L("Добровольная поддержка через PayPal и доступные способы оплаты Ko-fi.", "Voluntary support through PayPal and the payment methods available on Ko-fi.")},
  ];
  modal(`<section class="support-panel" aria-labelledby="support-title" data-no-translate>
    <div class="eyebrow">T_S_U_Y_U / EFT GPS</div>
    <h2 id="support-title">${L("Поддержать проект", "Support development")}</h2>
    <p class="support-intro">${L("EFT GPS — бесплатное приложение. Ваша поддержка помогает выделять время на разработку, тестирование и обновление данных.", "EFT GPS is free. Your support helps fund development time, testing and data updates.")}</p>
    <div class="support-free"><span aria-hidden="true">♡</span><span>${L("Все карты, GPS и задания доступны бесплатно. Поддержка полностью добровольная.", "All maps, GPS and quests remain free. Supporting the project is entirely optional.")}</span></div>
    <div class="support-options">${providers.map(provider => {
      const url = supportUrl(provider.id, links[provider.id]);
      return `<article class="support-option" data-support-provider="${provider.id}">
        <div class="support-provider-heading"><span class="support-provider-icon" aria-hidden="true">${provider.symbol}</span><div><h3>${provider.name}</h3><small>${provider.region}</small></div><span class="support-status ${url ? "ready" : ""}">${url ? L("Подключено", "Available") : L("Скоро", "Coming soon")}</span></div>
        <p>${provider.description}</p>
        ${url ? `<a class="button primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${L("Открыть", "Open")} ${provider.name} ↗</a>` : `<button type="button" disabled aria-disabled="true">${L("Приём поддержки скоро будет доступен", "Support payments are coming soon")}</button>`}
      </article>`;
    }).join("")}</div>
    <section class="support-benefits" aria-labelledby="support-benefits-title"><div class="support-benefits-heading"><h3 id="support-benefits-title">${L("Что получат подписчики", "Membership benefits")}</h3><small>${L("После запуска подписок", "When memberships launch")}</small></div>
      <ul><li><span aria-hidden="true">◇</span><div><strong>${L("Ваш никнейм в списке спонсоров", "Your nickname in the supporter credits")}</strong><p>${L("Добавим выбранный вами никнейм в благодарности внутри приложения — только с вашего согласия. Можно поддерживать проект и анонимно.", "We will add your chosen nickname to the in-app credits, only with your permission. You can also support the project anonymously.")}</p></div></li>
      <li><span aria-hidden="true">↗</span><div><strong>${L("Обновления раньше публичного выпуска", "Updates before the public release")}</strong><p>${L("Ранний доступ к тестовым сборкам и новым возможностям. Ссылки на них будут доступны подписчикам на странице автора.", "Early access to test builds and new features. Members will find the download links on the creator’s page.")}</p></div></li></ul>
      <p class="support-benefits-note">${L("Это бонусы подписки. Тестовые сборки могут содержать ошибки; стабильные обновления останутся бесплатными и будут доступны всем после выпуска.", "These are membership perks. Test builds may contain bugs; stable updates will remain free and available to everyone when released.")}</p>
    </section>
    <div class="support-explainer"><h3>${L("Как это работает", "How it works")}</h3><p>${L("Вы сами выбираете сумму и разовую поддержку или подписку на странице сервиса. Подписка означает регулярные списания — её условия и отмена доступны на выбранной площадке.", "Choose an amount and one-time support or a membership on the provider’s page. Memberships involve recurring payments; terms and cancellation are managed by the provider.")}</p><p>${L("Оплата открывается во внешнем браузере и требует интернета. EFT GPS не запрашивает данные карты и не хранит платёжные реквизиты.", "Payment opens in your external browser and requires internet access. EFT GPS does not request card details or store payment credentials.")}</p></div>
    ${providers.some(p => supportUrl(p.id, links[p.id])) ? "" : `<p class="support-pending">${L("Страницы автора ещё не подключены. Платёжные кнопки станут доступны после настройки и проверки выплат.", "The creator’s pages are not connected yet. Payment buttons will become available after payout setup and verification.")}</p>`}
  </section>`);
}
