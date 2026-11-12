// PWA support, as far as this hosting platform allows.
//
// The platform publishes only bundled assets (hashed names under
// ./assets/) — there is no fixed public path where a static
// manifest.webmanifest or sw.js could live, and a service worker could
// not be registered for the page's scope anyway. So this module wires
// everything that *can* be done from the client:
//   - apple-touch-icon / favicon pointing at the bundled icon PNGs
//   - a generated Web App Manifest (Blob URL) with name, colors,
//     standalone display and 192/512 + maskable icons
//   - capture of `beforeinstallprompt` so the UI can offer a real
//     install button where the browser supports it
import icon512 from "./assets/icon-512.png";
import icon192 from "./assets/icon-192.png";
import icon180 from "./assets/icon-180.png";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __dfInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function setupPwa() {
  if (typeof document === "undefined") return;
  const abs = (u: string) => new URL(u, document.baseURI).href;

  const touch = document.createElement("link");
  touch.rel = "apple-touch-icon";
  touch.href = abs(icon180);
  document.head.appendChild(touch);

  const fav = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (fav) fav.href = abs(icon192);

  try {
    const manifest = {
      name: "大富豪",
      short_name: "大富豪",
      description: "最大6人で遊べるトランプゲーム「大富豪」。オンライン対戦・CPU対戦対応。",
      lang: "ja",
      display: "standalone",
      orientation: "portrait",
      theme_color: "#07271e",
      background_color: "#07271e",
      start_url: new URL("./", document.baseURI).href,
      scope: new URL("./", document.baseURI).href,
      icons: [
        { src: abs(icon192), sizes: "192x192", type: "image/png", purpose: "any" },
        { src: abs(icon512), sizes: "512x512", type: "image/png", purpose: "any" },
        { src: abs(icon512), sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], {
      type: "application/manifest+json",
    });
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);
  } catch {
    // Manifest generation is best-effort; the game works without it.
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__dfInstallPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("df-install-ready"));
  });
  window.addEventListener("appinstalled", () => {
    window.__dfInstallPrompt = null;
    window.dispatchEvent(new Event("df-install-ready"));
  });
}
