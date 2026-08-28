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

function getPrompt(): any {
  if (typeof window === "undefined") return null;
  return (window as any).__pwa_deferred_prompt || globalDeferredPrompt;
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);
    setCanInstall(!!getPrompt());

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
    const promptObj = getPrompt();
    if (promptObj) {
      try {
        promptObj.prompt();
        const choice = await promptObj.userChoice;
        console.log("PWA user choice:", choice?.outcome);
        globalDeferredPrompt = null;
        if (typeof window !== "undefined") {
          (window as any).__pwa_deferred_prompt = null;
        }
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
