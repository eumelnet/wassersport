'use strict';

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn   = document.getElementById('login-btn');
  const error = document.getElementById('login-error');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  error.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Einen Moment…';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (data.ok) {
      window.location.href = window.WassersportLang.withLanguage('/mitglieder');
    } else {
      error.textContent = data.error || 'Anmeldung fehlgeschlagen.';
      btn.disabled = false;
      btn.textContent = 'Anmelden';
    }
  } catch {
    error.textContent = 'Netzwerkfehler. Bitte erneut versuchen.';
    btn.disabled = false;
    btn.textContent = 'Anmelden';
  }
});
