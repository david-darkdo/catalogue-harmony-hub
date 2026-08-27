import { useState, useEffect } from "react";

let globalDeferredPrompt: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    window.dispatchEvent(new CustomEvent("pwa:installable"));
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pwa:installed"));
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
    const handleInstalled = () => {
      setCanInstall(false);
      setIsStandalone(true);
    };

    window.addEventListener("pwa:installable", handleInstallable);
    window.addEventListener("pwa:installed", handleInstalled);

    return () => {
      window.removeEventListener("pwa:installable", handleInstallable);
      window.removeEventListener("pwa:installed", handleInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (globalDeferredPrompt) {
      try {
        globalDeferredPrompt.prompt();
        const choice = await globalDeferredPrompt.userChoice;
        console.log("PWA user choice:", choice?.outcome);
        globalDeferredPrompt = null;
        setCanInstall(false);
        return true;
      } catch (err) {
        console.warn("PWA install error:", err);
      }
    }
    return false;
  };

  return { canInstall, isStandalone, triggerInstall };
}
