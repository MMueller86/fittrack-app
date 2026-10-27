(function () {
  'use strict';
  // Fixed target host; variant and package come from static page attributes, never from the URL.
  var HOST = 'red-mushroom-07229ab10.3.azurestaticapps.net';
  var ALLOWED = ['code', 'state', 'error', 'error_description'];
  var VARIANTS = { alpha: 'com.fittrack.app', dev: 'com.fittrack.app.dev' };

  var root = document.documentElement;
  var variant = root.getAttribute('data-variant');
  var pkg = VARIANTS[variant];
  if (!pkg || root.getAttribute('data-package') !== pkg) return;

  var incoming = new URLSearchParams(window.location.search);
  var out = new URLSearchParams();
  ALLOWED.forEach(function (key) {
    var value = incoming.get(key);
    if (value !== null) out.append(key, value);
  });

  var query = out.toString();
  var intentUrl = 'intent://' + HOST + '/auth/callback/' + variant +
    (query ? '?' + query : '') + '#Intent;scheme=https;package=' + pkg + ';end';

  window.history.replaceState(null, '', window.location.pathname);

  var back = document.getElementById('back');
  back.setAttribute('href', intentUrl);

  window.location.replace(intentUrl);

  window.setTimeout(function () {
    if (document.visibilityState === 'visible') {
      document.getElementById('status').textContent =
        'Die Weiterleitung zur App hat nicht funktioniert.';
      back.hidden = false;
    }
  }, 2500);
})();
