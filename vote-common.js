// Shared logic for the two standalone voter pages (vote-pyramid.html,
// vote-personae.html) and the presenter dashboard (index.html). Plain script,
// no bundler — exposes everything under window.PodVote.
window.PodVote = (function () {
  'use strict';

  // Public Firebase project config — safe to expose client-side; access to
  // the vote data is controlled by the Realtime Database rules, not by
  // hiding this key. Anyone with the page link can vote, no account needed.
  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDBsFDKyEc6jE7L7u7yK3xWQ7a9hi_psCs',
    authDomain: 'pod-odyssey-interact.firebaseapp.com',
    databaseURL: 'https://pod-odyssey-interact-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'pod-odyssey-interact',
    storageBucket: 'pod-odyssey-interact.firebasestorage.app',
    messagingSenderId: '1075684337730',
    appId: '1:1075684337730:web:5ace185c293043950165db'
  };

  function getVoterId() {
    try {
      var k = 'podPyramidVoterId';
      var v = localStorage.getItem(k);
      if (!v) {
        v = 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return 'v-' + Math.random().toString(36).slice(2, 10);
    }
  }

  function renderQR(elId, url) {
    var frame = document.getElementById(elId);
    if (!frame) return;
    if (window.QRCode) {
      try {
        new QRCode(frame, {
          text: url,
          width: 176,
          height: 176,
          colorDark: '#002060',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
        return;
      } catch (e) {}
    }
    var fallback = document.createElement('p');
    fallback.className = 'qr-fallback';
    fallback.textContent = 'QR indisponible hors-ligne : utilisez le lien ci-dessous.';
    frame.appendChild(fallback);
  }

  function showBanner(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.add('is-visible');
  }

  // Renders a single poll as a standalone voter card into #pollCards and wires it
  // straight to Firebase — each of the two dedicated pages calls this once with
  // its own poll only, so a voter never sees the other vote's options.
  function mountVoterPoll(poll) {
    var wrap = document.getElementById('pollCards');
    var section = document.createElement('section');
    section.className = 'poll-card';
    section.innerHTML =
      '<span class="voter-eyebrow">' + poll.eyebrow + '</span>' +
      '<h1>' + poll.voterTitle + '</h1>' +
      '<p class="hint">' + poll.hint + '</p>' +
      '<div class="options" id="options-' + poll.key + '"></div>' +
      '<p class="voter-confirm" id="confirm-' + poll.key + '" hidden>' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
        poll.confirmText +
      '</p>';
    wrap.appendChild(section);

    var opts = document.getElementById('options-' + poll.key);
    poll.options.forEach(function (o) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      btn.dataset.opt = o.id;
      btn.style.setProperty('--tier-color', o.color);
      btn.innerHTML =
        '<span class="option-swatch"></span>' +
        '<span class="option-text"><strong>' + o.label + '</strong><span>' + o.sub + '</span></span>' +
        '<span class="option-check"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>';
      opts.appendChild(btn);
    });

    if (typeof firebase === 'undefined' || !firebase.database) {
      showBanner('voterBanner', 'Le service de vote n’a pas pu se charger — vérifiez votre connexion et rechargez la page.');
      return;
    }

    firebase.initializeApp(FIREBASE_CONFIG);
    var pollRef = firebase.database().ref().child(poll.dbPath);
    var voterId = getVoterId();
    var myRef = pollRef.child(voterId);
    var selected = {};

    var persistSelection = function () {
      var hasAny = Object.keys(selected).some(function (k) { return selected[k]; });
      myRef.set({ floors: selected, ts: Date.now() }).then(function () {
        var confirmEl = document.getElementById('confirm-' + poll.key);
        if (confirmEl) confirmEl.hidden = !hasAny;
      }).catch(function () {
        showBanner('voterBanner', 'La sélection n’a pas pu être enregistrée — réessayez.');
      });
    };

    myRef.once('value').then(function (snap) {
      if (!snap.exists()) return;
      var data = snap.val();
      if (data && data.floors && typeof data.floors === 'object') {
        selected = data.floors;
      } else if (data && data.floor !== undefined && data.floor !== null) {
        selected[data.floor] = true;
      }
      var any = false;
      Object.keys(selected).forEach(function (k) {
        if (!selected[k]) return;
        any = true;
        var el = document.querySelector('.option[data-opt="' + k + '"]');
        if (el) el.classList.add('is-selected');
      });
      var confirmEl = document.getElementById('confirm-' + poll.key);
      if (confirmEl) confirmEl.hidden = !any;
    }).catch(function () {});

    document.querySelectorAll('#options-' + poll.key + ' .option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var optId = btn.dataset.opt;
        var nowSelected = !btn.classList.contains('is-selected');
        btn.classList.toggle('is-selected', nowSelected);
        selected[optId] = nowSelected ? true : null;
        persistSelection();
      });
    });
  }

  return {
    FIREBASE_CONFIG: FIREBASE_CONFIG,
    getVoterId: getVoterId,
    renderQR: renderQR,
    showBanner: showBanner,
    mountVoterPoll: mountVoterPoll
  };
})();
