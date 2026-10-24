export function handleMobileBack(screen, navigateHome) {
  if (screen === 'home') return false;
  if (typeof navigateHome === 'function') navigateHome();
  return true;
}
