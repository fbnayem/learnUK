/* Learn UK: Elementor editor preview helper.
 * Elementor renders widgets client-side in the editor, so the server-side placeholder
 * filter never sees them. This rewrites https://lu.home/ and https://lu.assets/ in
 * attributes and <style> text, applies lu-attr__ classes, and loads main.js once the
 * content has rendered. */
(function () {
  var cfg = window.LU;
  if (!cfg) return;
  var pairs = [['https://lu.home/', cfg.home], ['https://lu.assets/', cfg.assets]];
  pairs = pairs.concat(pairs.map(function (p) { return [p[0].replace(/\//g, '\\/'), p[1].replace(/\//g, '\\/')]; }));

  function fix(text) {
    pairs.forEach(function (p) { text = text.split(p[0]).join(p[1]); });
    return text;
  }

  function fixEl(el) {
    if (el.tagName === 'STYLE') {
      if (el.textContent.indexOf('lu.') !== -1) {
        var css = fix(el.textContent);
        if (css !== el.textContent) el.textContent = css;
      }
      return;
    }
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.value.indexOf('https:') === -1 || a.value.indexOf('lu.') === -1) continue;
      var v = fix(a.value);
      if (v !== a.value) el.setAttribute(a.name, v);
    }
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    fixEl(root);
    var all = root.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) fixEl(all[i]);
    if (window.luApplyAttrs) window.luApplyAttrs(root);
  }

  new MutationObserver(function (records) {
    records.forEach(function (r) {
      if (r.type === 'attributes') {
        fixEl(r.target);
        if (r.attributeName === 'class' && window.luApplyAttrs) window.luApplyAttrs(r.target);
      } else if (r.type === 'characterData') {
        if (r.target.parentNode && r.target.parentNode.tagName === 'STYLE') fixEl(r.target.parentNode);
      } else {
        if (r.target.tagName === 'STYLE') fixEl(r.target);
        r.addedNodes.forEach(scan);
      }
    });
    scheduleMain();
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });

  scan(document.documentElement);

  // main.js initialises once, so wait until the editor has rendered the page content.
  // Elements added later are styled but not enhanced until the preview reloads.
  var loaded = false;
  var timer;
  function scheduleMain() {
    if (loaded) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (loaded || !document.querySelector('.elementor .elementor-element')) return;
      loaded = true;
      import(cfg.assets + 'js/main.js?ver=' + encodeURIComponent(cfg.ver || '')).catch(function () {});
    }, 800);
  }
})();
