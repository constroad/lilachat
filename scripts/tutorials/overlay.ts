/**
 * The layer injected over the page while recording: caption, cursor, focus box, progress bar and
 * the intro card. It is a STRING that runs inside the page, so the recorder checks it parses
 * before opening the browser. Ported from Portal (`scripts/academyRecorderOverlay.ts`).
 *
 * Selectors: `testid:x` (data-testid), `text:x` (deepest element with that text), `boton:x`
 * (button or link with that exact text, inside the open dialog first), `ph:x` (placeholder) and
 * `xpath:x` (a row's button by the text of its row).
 * `cameraNames` rewrites texts that cannot appear on camera («QA», «borrar»), at any depth.
 */
export const OVERLAY_SOURCE = `(() => {
  if (window.__tutorial) return;
  const accent = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    return value ? (value.startsWith('#') || value.includes('(') ? value : 'rgb(' + value + ')') : 'currentColor';
  };
  const styles = \`
    .tut-layer{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:system-ui,-apple-system,sans-serif}
    .tut-caption{position:fixed;left:50%;bottom:18px;transform:translateX(-50%) translateY(10px);width:max-content;max-width:94vw;
      display:flex;gap:9px;align-items:flex-start;padding:10px 13px;border-radius:12px;background:rgba(15,23,42,.94);
      color:#fff;font-size:13.5px;line-height:1.38;font-weight:500;opacity:0;box-shadow:0 18px 50px rgba(2,6,23,.45);
      transition:opacity .35s ease,transform .35s ease}
    .tut-caption.on{opacity:1;transform:translateX(-50%) translateY(0)}
    .tut-caption i{display:block;width:4px;align-self:stretch;border-radius:4px;background:var(--tut-accent);flex:0 0 4px}
    .tut-focus{position:fixed;border-radius:14px;border:2px solid var(--tut-accent);box-shadow:0 0 0 9999px rgba(15,23,42,.32);
      opacity:0;transition:opacity .3s ease,all .45s cubic-bezier(.22,.61,.36,1)}
    .tut-focus.on{opacity:1}
    .tut-cursor{position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,255,255,.9);
      border:2px solid var(--tut-accent);box-shadow:0 4px 14px rgba(2,6,23,.35);opacity:0;transition:opacity .3s ease,transform .55s cubic-bezier(.22,.61,.36,1)}
    .tut-cursor.on{opacity:1}
    .tut-card{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;
      background:rgba(15,23,42,.97);color:#fff;opacity:0;transition:opacity .5s ease;text-align:center}
    .tut-card.on{opacity:1}
    .tut-card h1{font-size:30px;font-weight:700;margin:0}
    .tut-card p{font-size:15px;margin:0;color:rgba(226,232,240,.85)}
    .tut-card span{width:56px;height:4px;border-radius:4px;background:var(--tut-accent)}
    .tut-bar{position:fixed;top:0;left:0;height:3px;background:var(--tut-accent);width:0;transition:width .45s ease}
    @media (min-width: 768px){
      .tut-caption{bottom:44px;max-width:min(880px,88vw);gap:14px;padding:16px 22px;font-size:19px;border-radius:16px}
      .tut-card h1{font-size:46px}
      .tut-card p{font-size:20px}
    }
  \`;
  const layer = document.createElement('div');
  layer.className = 'tut-layer';
  layer.innerHTML = '<style>' + styles + '</style><div class="tut-bar"></div><div class="tut-focus"></div>' +
    '<div class="tut-cursor"></div><div class="tut-caption"><i></i><span class="tut-text"></span></div>' +
    '<div class="tut-card"><h1></h1><span></span><p></p></div>';
  // At new-document time there is no body yet: the layer and the watcher mount when it exists.
  const mount = () => {
    document.documentElement.style.setProperty('--tut-accent', accent());
    document.body.appendChild(layer);
    watch();
  };
  const part = (cls) => layer.querySelector(cls);
  const ours = (el) => layer.contains(el);
  const textOf = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const openDialog = () => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    return dialogs[dialogs.length - 1] || null;
  };
  const insideDialog = (nodes) => {
    const dialog = openDialog();
    const inside = dialog ? nodes.filter((el) => dialog.contains(el)) : [];
    return inside.length ? inside : nodes;
  };
  const deepestWith = (needle) => Array.from(document.body.querySelectorAll('*')).filter((el) =>
    !ours(el) && textOf(el).includes(needle) && !Array.from(el.children).some((child) => textOf(child).includes(needle)));
  const resolve = (selector) => {
    if (selector.startsWith('testid:')) {
      const all = Array.from(document.querySelectorAll('[data-testid="' + selector.slice(7) + '"]'));
      return insideDialog(all)[0] || null;
    }
    if (selector.startsWith('ph:')) {
      const needle = selector.slice(3).trim().toLowerCase();
      const fields = Array.from(document.querySelectorAll('input,textarea')).filter((el) =>
        (el.getAttribute('placeholder') || '').trim().toLowerCase().startsWith(needle));
      return insideDialog(fields)[0] || null;
    }
    if (selector.startsWith('boton:')) {
      const needle = selector.slice(6).trim().toLowerCase();
      const buttons = Array.from(document.querySelectorAll('button,[role="tab"],a')).filter((el) => !ours(el) && textOf(el) === needle);
      return insideDialog(buttons)[0] || null;
    }
    if (selector.startsWith('text:')) return insideDialog(deepestWith(selector.slice(5).trim().toLowerCase()))[0] || null;
    if (selector.startsWith('xpath:')) return document.evaluate(selector.slice(6), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    return document.querySelector(selector);
  };
  let names = [];
  const rename = (root) => {
    if (!names.length || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (ours(node.parentElement)) continue;
      let value = node.nodeValue || '';
      for (const [from, to] of names) if (value.includes(from)) value = value.split(from).join(to);
      if (value !== node.nodeValue) node.nodeValue = value;
    }
  };
  const watch = () => new MutationObserver((changes) => changes.forEach((change) =>
    change.type === 'characterData' ? rename(change.target.parentElement) : change.addedNodes.forEach((node) => rename(node.nodeType === 3 ? node.parentElement : node))
  )).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.__tutorial = {
    resolve,
    cameraNames(map) {
      names = Object.entries(map || {}).sort((a, b) => b[0].length - a[0].length);
      rename(document.body);
    },
    caption(text) { part('.tut-text').textContent = text; part('.tut-caption').classList.add('on'); },
    hideCaption() { part('.tut-caption').classList.remove('on'); },
    progress(ratio) { part('.tut-bar').style.width = Math.round(ratio * 100) + '%'; },
    card(title, subtitle) {
      const card = part('.tut-card');
      card.querySelector('h1').textContent = title || '';
      card.querySelector('p').textContent = subtitle || '';
      card.classList.add('on');
    },
    hideCard() { part('.tut-card').classList.remove('on'); },
    focus(selector) {
      const el = resolve(selector);
      const box = part('.tut-focus');
      if (!el) { box.classList.remove('on'); return false; }
      const rect = el.getBoundingClientRect();
      Object.assign(box.style, { left: rect.left - 8 + 'px', top: rect.top - 8 + 'px', width: rect.width + 16 + 'px', height: rect.height + 16 + 'px' });
      box.classList.add('on');
      return true;
    },
    blur() { part('.tut-focus').classList.remove('on'); },
    pointAt(selector) {
      const el = resolve(selector);
      const cursor = part('.tut-cursor');
      if (!el) { cursor.classList.remove('on'); return false; }
      const rect = el.getBoundingClientRect();
      cursor.style.transform = 'translate(' + (rect.left + rect.width / 2) + 'px,' + (rect.top + rect.height / 2) + 'px)';
      cursor.classList.add('on');
      return true;
    },
    hideCursor() { part('.tut-cursor').classList.remove('on'); },
    scrollTo(selector) {
      const el = resolve(selector);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    },
    clickOn(selector) {
      const el = resolve(selector);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const common = { bubbles: true, cancelable: true, composed: true, button: 0, buttons: 1, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
      const pointer = Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true }, common);
      el.dispatchEvent(new PointerEvent('pointerdown', pointer));
      el.dispatchEvent(new MouseEvent('mousedown', common));
      el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, pointer, { buttons: 0 })));
      el.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, common, { buttons: 0 })));
      const open = el.getAttribute('data-state') === 'open' || el.getAttribute('aria-expanded') === 'true';
      if (!open) el.click();
      return true;
    },
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();`;
