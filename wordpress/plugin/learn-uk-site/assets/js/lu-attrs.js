/* Learn UK: turn lu-attr__{name} and lu-attr__{name}__{value} classes into attributes. */
(function () {
  var re = /^lu-attr__([a-z0-9-]+)(?:__([a-z0-9-]+))?$/;
  function apply(root) {
    if (!root || root.nodeType !== 1) return;
    var els = [].slice.call(root.querySelectorAll('[class*="lu-attr__"]'));
    if (root.matches && root.matches('[class*="lu-attr__"]')) els.unshift(root);
    els.forEach(function (el) {
      [].slice.call(el.classList).forEach(function (cls) {
        var m = re.exec(cls);
        if (!m || /^on/.test(m[1])) return;
        el.setAttribute(m[1], m[2] || '');
        el.classList.remove(cls);
      });
    });
  }
  window.luApplyAttrs = apply;
  apply(document.documentElement);
})();
