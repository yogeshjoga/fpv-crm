// A Google sign-in that was started on the public website (www.egirerobotics.com) can be sent back to THIS site by mistake: when the
// sign-in service does not recognise the website's return address it falls back to this site's address, with a one-time code in it.
// That code only works on the site that started the sign-in, so pass it straight back to the website, which finishes the sign-in and
// opens the Academy. A sign-in that started here has its own key in the browser, and is left alone.
(function () {
  var path = location.pathname.replace(/\/+/g, '/');
  if (path !== '/' || !/[?&]code=/.test(location.search)) return;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      if (/code-verifier/.test(localStorage.key(i))) return;
    }
  } catch (e) { /* storage is blocked: nothing started here either */ }
  location.replace('https://www.egirerobotics.com/auth/callback' + location.search);
})();
