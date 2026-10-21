(() => {
  if (!("serviceWorker" in navigator)) return;
  if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) return;

  let installPrompt;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Install Tradify Signals";
  button.setAttribute("aria-haspopup", "dialog");
  button.style.cssText = [
    "position:fixed",
    "right:14px",
    "bottom:calc(env(safe-area-inset-bottom, 0px) + 82px)",
    "z-index:2147483000",
    "min-height:46px",
    "padding:0 16px",
    "border:1px solid #EBC76B",
    "border-radius:999px",
    "background:#EBB22D",
    "color:#191F29",
    "font:700 13px Inter,system-ui,sans-serif",
    "box-shadow:0 8px 24px #0006",
    "cursor:pointer",
  ].join(";");

  const dialog = document.createElement("div");
  dialog.hidden = true;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "tradify-install-title");
  dialog.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483001",
    "display:none",
    "align-items:flex-end",
    "justify-content:center",
    "padding:18px",
    "background:#05080bcc",
    "font:14px/1.5 Inter,system-ui,sans-serif",
  ].join(";");

  const panel = document.createElement("section");
  panel.style.cssText = [
    "width:min(100%,460px)",
    "padding:22px",
    "border:1px solid #36404E",
    "border-radius:20px",
    "background:#1F2732",
    "color:#EEEAE2",
    "box-shadow:0 20px 60px #0008",
  ].join(";");

  const title = document.createElement("h2");
  title.id = "tradify-install-title";
  title.textContent = "Install Tradify Signals";
  title.style.cssText = "margin:0 36px 8px 0;font-size:19px;line-height:1.25";

  const instructions = document.createElement("p");
  instructions.style.cssText = "margin:0 0 18px;color:#C3CBD3";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText = "min-height:42px;padding:0 15px;border:1px solid #596574;border-radius:12px;background:#28313E;color:#EEEAE2;font:600 14px Inter,system-ui,sans-serif";
  close.addEventListener("click", () => {
    dialog.hidden = true;
    dialog.style.display = "none";
    button.focus();
  });
  panel.append(title, instructions, close);
  dialog.append(panel);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close.click();
  });
  document.body.append(button, dialog);

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
  const showInstructions = () => {
    if (isIos && isSafari) {
      instructions.textContent = "In Safari, tap Share, then choose “Add to Home Screen”. The installed app opens in its own window where supported.";
    } else if (isIos) {
      instructions.textContent = "On iPhone or iPad, open this page in Safari, tap Share, then choose “Add to Home Screen”. Installation support varies by iOS version and browser.";
    } else if (/android/i.test(navigator.userAgent)) {
      instructions.textContent = "If your browser has no install prompt, open its menu and choose “Install app” or “Add to Home screen”. The wording varies by browser.";
    } else {
      instructions.textContent = "Use your browser’s Install app control near the address bar or in its menu. If installation is unavailable, continue using Tradify Signals in this browser.";
    }
    dialog.hidden = false;
    dialog.style.display = "flex";
    close.focus();
  };

  button.addEventListener("click", async () => {
    if (!installPrompt) {
      showInstructions();
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = undefined;
    button.hidden = true;
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    button.hidden = true;
  });
})();
