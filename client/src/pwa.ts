// PWA support, as far as this hosting platform allows.
//
// The platform publishes only bundled assets (hashed names under
// ./assets/) — there is no fixed public path where a static
// manifest.webmanifest or sw.js could live, and a service worker could
// not be registered for the page's scope anyway. So this module wires
// everything that *can* be done from the client:
//   - apple-touch-icon / favicon pointing at the bundled icon PNGs
//     (index.html also carries static links to the same files; this
//     module refreshes them to absolute URLs at runtime)
//   - a generated Web App Manifest (Blob URL) with name, colors,
//     standalone display and 192/512 + a dedicated maskable 512 icon
//   - capture of `beforeinstallprompt` so the UI can offer a real
//     install button where the browser supports it
//
// Icon artwork: original design in ./assets/icon.svg (deep-green felt,
// gold double frame, a fan of three cards and a gold crown), rasterised
// to icon-512/192 (any), icon-maskable-512 (safe-zone padded) and
// icon-180 (opaque, for iOS) PNGs.
import icon512 from "./assets/icon-512.png";
import icon192 from "./assets/icon-192.png";
import icon180 from "./assets/icon-180.png";
import iconMaskable512 from "./assets/icon-maskable-512.png";
import icon32 from "./assets/icon-32.png";
import iconSvg from "./assets/icon.svg";

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

  const ensureLink = (selector: string, rel: string) => {
    let el = document.querySelector<HTMLLinkElement>(selector);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      document.head.appendChild(el);
    }
    return el;
  };

  const touch = ensureLink('link[rel="apple-touch-icon"]', "apple-touch-icon");
  touch.href = abs(icon180);
  touch.setAttribute("sizes", "180x180");

  const favSvg = ensureLink(
    'link[rel="icon"][type="image/svg+xml"]',
    "icon",
  );
  favSvg.type = "image/svg+xml";
  favSvg.href = abs(iconSvg);

  const favPng = ensureLink('link[rel="icon"][type="image/png"]', "icon");
  favPng.type = "image/png";
  favPng.href = abs(icon32);
  favPng.setAttribute("sizes", "32x32");

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
        { src: abs(iconMaskable512), sizes: "512x512", type: "image/png", purpose: "maskable" },
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
