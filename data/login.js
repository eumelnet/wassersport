'use strict';

const i18n = window.WassersportI18n;

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn   = document.getElementById('login-btn');
  const error = document.getElementById('login-error');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  error.textContent = '';
  btn.disabled = true;
  btn.textContent = i18n.t('login.loading');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (data.ok) {
      window.location.href = i18n.withLanguage('/mitglieder');
    } else {
      error.textContent = data.error || i18n.t('login.failed');
      btn.disabled = false;
      btn.textContent = i18n.t('login.submit');
    }
  } catch {
    error.textContent = i18n.t('login.network');
    btn.disabled = false;
    btn.textContent = i18n.t('login.submit');
  }
});
