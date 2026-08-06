# RoadGuard — React Version

This is a React (Vite) port of the original `index_4.html` single-file
RoadGuard site. It keeps every page, the interactive logic, and the visual
design fully intact.

## Structure

```
roadguard-react/
├── index.html              Vite entry HTML (fonts + Font Awesome CDN links)
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx             React root
    ├── App.jsx              Mounts the app markup + boots its JS logic
    ├── App.css              All of the site's original CSS (extracted from
    │                        the <style> block)
    └── fragments/
        ├── body.html        The original <body> markup (navbar + all
        │                    pages: home, login, register, report form,
        │                    reports list, dashboard, profile,
        │                    notifications, contact, footer, modal)
        └── app.js            The original inline <script> — all page
                               navigation, auth flow, report data (with the
                               embedded photos), filtering/pagination,
                               and form handling
```

`App.jsx` imports `body.html` and `app.js` as raw text (via Vite's `?raw`
loader) and:

1. Renders the HTML fragment into the page.
2. Injects the original script as a real `<script>` tag once the component
   mounts, so all of its `function` declarations (e.g. `goTo`, `loginUser`,
   `renderReports`, etc.) become available exactly as they did in the
   original static page, and the app's own initialization code
   (`renderReports()`, `document.getElementById('mainFooter')...`) runs
   after the markup is in the DOM.

This keeps 100% functional and visual parity with the original file while
making it a proper React project you can build on, add routes to, or
gradually break into smaller components.

## Run it

```bash
cd roadguard-react
npm install
npm run dev       # start the dev server
npm run build     # production build
npm run preview   # preview the production build
```

## Notes

- All 15 sample pothole reports (with their embedded base64 photos) are
  preserved as-is inside `src/fragments/app.js`, in the `reportsData` array.
- Login/registration use an in-memory "database" (`registeredUsers`) that
  resets on page reload — same behavior as the original demo.
- If you want to keep evolving this into idiomatic React (separate
  components + `useState` instead of raw DOM manipulation), the next step
  would be to split each page section in `body.html` into its own
  component and move the logic in `app.js` into hooks — this project keeps
  the original logic intact as a starting point rather than a full rewrite.
