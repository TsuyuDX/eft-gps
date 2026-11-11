const paths = {
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5",
  moon: "M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z",
  calendar: "M5 5h14v16H5ZM8 3v4M16 3v4M5 10h14M9 14h1M14 14h1M9 17h1",
  locate: "M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0M12 2v5M12 17v5M2 12h5M17 12h5",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  left: "m15 6-6 6 6 6",
  right: "m9 6 6 6-6 6",
  down: "m6 9 6 6 6-6",
  check: "m5 12 4 4L19 6",
  home: "m4 11 8-7 8 7M7 10v10h10V10M10 20v-6h4v6",
  expand: "M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4",
  collapse: "M4 8h4V4M16 4v4h4M20 16h-4v4M8 20v-4H4",
  filters: "M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M9 16v4",
  list: "M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1",
  info: "M12 11v6M12 7h.01",
  search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
};
export function uiIcon(name, size = 20) {
  return (
    '<svg class="ui-icon" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    (name === "info" ? '<circle cx="12" cy="12" r="9"/>' : "") +
    '<path d="' +
    (paths[name] || paths.info) +
    '"/></svg>'
  );
}
