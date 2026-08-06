import { useEffect, useRef } from 'react';
import './App.css';

// The original static site's markup and behavior are imported as raw text
// (via Vite's `?raw` loader) and mounted/executed inside this component.
// This preserves 100% of the original app's pages (home, login, register,
// report form, reports list + modal, dashboard, profile, notifications,
// contact) and all of its interactive JS logic, while running it as part
// of a React component tree.
import { api } from './api';
import bodyHtml from './fragments/body.html?raw';
import appScript from './fragments/app.js?raw';

window.api = api;
let scriptInjected = false;


function App() {
  const containerRef = useRef(null);

  useEffect(() => {
    // Guard against React 18 StrictMode's double-invoked effects in dev,
    // which would otherwise redeclare functions/run setup code twice.
    if (scriptInjected) return;
    scriptInjected = true;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.text = appScript;
    document.body.appendChild(script);
  }, []);

  return (
    <div
      ref={containerRef}
      id="roadguard-app"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}

export default App;
