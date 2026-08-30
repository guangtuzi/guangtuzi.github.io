(function () {
  'use strict';

  var root = document.documentElement;
  var english = /^en(?:-|$)/i.test(root.getAttribute('lang') || '');
  var themeButton = document.querySelector('[data-theme-toggle]');
  var navButton = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-site-nav]');
  var progress = document.querySelector('[data-reading-progress]');
  var copyStatus = document.getElementById('copy-status');
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function effectiveTheme() {
    return root.dataset.theme || (media && media.matches ? 'dark' : 'light');
  }

  function updateThemeButton() {
    if (!themeButton) return;
    var dark = effectiveTheme() === 'dark';
    var icon = themeButton.querySelector('[data-theme-icon]');
    themeButton.setAttribute('aria-label', english ? (dark ? 'Switch to light mode' : 'Switch to dark mode') : (dark ? '切换到浅色模式' : '切换到深色模式'));
    themeButton.setAttribute('title', english ? (dark ? 'Light mode' : 'Dark mode') : (dark ? '浅色模式' : '深色模式'));
    if (icon) icon.textContent = dark ? '☀' : '◐';
  }

  if (themeButton) {
    updateThemeButton();
    themeButton.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('terminal-canvas-theme', next); } catch (_) {}
      updateThemeButton();
    });
  }

  if (media) {
    var onSystemTheme = function () {
      if (!root.dataset.theme) updateThemeButton();
    };
    if (media.addEventListener) media.addEventListener('change', onSystemTheme);
    else if (media.addListener) media.addListener(onSystemTheme);
  }

  function setMenu(open) {
    if (!navButton || !nav) return;
    nav.classList.toggle('is-open', open);
    navButton.classList.toggle('is-open', open);
    navButton.setAttribute('aria-expanded', String(open));
    var label = navButton.querySelector('.sr-only');
    if (label) label.textContent = english ? (open ? 'Close navigation' : 'Open navigation') : (open ? '关闭导航' : '打开导航');
  }

  function menuIsOpen() {
    return Boolean(navButton && nav && navButton.getAttribute('aria-expanded') === 'true');
  }

  if (navButton && nav) {
    navButton.addEventListener('click', function () {
      setMenu(navButton.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('pointerdown', function (event) {
      if (window.innerWidth > 1100 || !menuIsOpen()) return;
      if (!nav.contains(event.target) && !navButton.contains(event.target)) setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuIsOpen()) {
        setMenu(false);
        navButton.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1100) setMenu(false);
    });
  }

  if (progress && document.querySelector('[data-post-content]')) {
    var ticking = false;
    var updateProgress = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress.style.transform = 'scaleX(' + ratio + ')';
      ticking = false;
    };
    var requestProgress = function () {
      if (!ticking) {
        window.requestAnimationFrame(updateProgress);
        ticking = true;
      }
    };
    progress.classList.add('is-visible');
    window.addEventListener('scroll', requestProgress, { passive: true });
    window.addEventListener('resize', requestProgress);
    updateProgress();
  }

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(area);
    return copied ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return legacyCopy(text);
  }

  var codeRoots = Array.prototype.slice.call(document.querySelectorAll('.post-content figure.highlight, .post-content pre'));
  codeRoots = codeRoots.filter(function (node) {
    return node.matches('figure.highlight') || !node.closest('figure.highlight');
  });

  codeRoots.forEach(function (node) {
    var source = node.matches('figure.highlight')
      ? (node.querySelector('.code pre') || node.querySelector('pre'))
      : (node.querySelector('code') || node);
    if (!source) return;

    var host = node;
    if (node.tagName === 'PRE') {
      host = document.createElement('div');
      host.className = 'code-frame';
      node.parentNode.insertBefore(host, node);
      host.appendChild(node);
    } else {
      node.classList.add('code-frame');
    }

    var button = document.createElement('button');
    button.className = 'copy-button';
    button.type = 'button';
    button.textContent = english ? 'Copy' : '复制';
    button.setAttribute('aria-label', english ? 'Copy code' : '复制代码');
    host.appendChild(button);

    button.addEventListener('click', function () {
      copyText(source.textContent || '').then(function () {
        button.textContent = english ? 'Copied' : '已复制';
        button.classList.add('is-copied');
        if (copyStatus) copyStatus.textContent = english ? 'Code copied to clipboard' : '代码已复制到剪贴板';
        window.setTimeout(function () {
          button.textContent = english ? 'Copy' : '复制';
          button.classList.remove('is-copied');
        }, 1800);
      }).catch(function () {
        button.textContent = english ? 'Copy failed' : '复制失败';
        if (copyStatus) copyStatus.textContent = english ? 'Copy failed. Please select the code manually.' : '代码复制失败，请手动选择代码';
      });
    });
  });
}());
