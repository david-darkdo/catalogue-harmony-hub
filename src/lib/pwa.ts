import { useState, useEffect } from "react";

let globalDeferredPrompt: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    window.dispatchEvent(new CustomEvent("pwa:installable"));
  });
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(!!globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);

    const handleInstallable = () => setCanInstall(true);
    window.addEventListener("pwa:installable", handleInstallable);
    return () => window.removeEventListener("pwa:installable", handleInstallable);
  }, []);

  const triggerInstall = async () => {
    if (globalDeferredPrompt) {
      globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      globalDeferredPrompt = null;
      setCanInstall(false);
      return true;
    }
    return false;
  };

  return { canInstall, isStandalone, triggerInstall };
}
