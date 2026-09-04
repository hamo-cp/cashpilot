/**
 * @module ui/install
 * @description إدارة دورة حياة زر تثبيت الـPWA دون عرض control غير قابل للتنفيذ.
 */

export function bindPWAInstall({
  root = document,
  view = window,
  nav = navigator,
} = {}) {
  const button = root.getElementById?.('installBtn');
  if (!button) return;

  let deferredPrompt = null;
  const isStandalone = () => (
    view.matchMedia?.('(display-mode: standalone)')?.matches === true
    || nav.standalone === true
  );
  const hide = () => {
    button.hidden = true;
    button.disabled = false;
  };

  hide();

  view.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (isStandalone()) {
      deferredPrompt = null;
      hide();
      return;
    }
    deferredPrompt = event;
    button.hidden = false;
    button.disabled = false;
  });

  button.addEventListener('click', async () => {
    const promptEvent = deferredPrompt;
    if (!promptEvent) return;

    deferredPrompt = null;
    button.hidden = true;
    button.disabled = true;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } finally {
      button.disabled = false;
    }
  });

  view.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hide();
  });
}
