document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const message = document.getElementById('login-message');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const toggleButton = document.querySelector('.toggle-password');

  if (sessionStorage.getItem('gestionStagiairesToken')) {
    window.location.replace('/dashboard');
    return;
  }

  if (toggleButton && passwordInput) {
    toggleButton.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      toggleButton.textContent = isHidden ? '🙈' : '👁';
      toggleButton.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      passwordInput.focus();
    });
  }

  if (!form || !emailInput || !passwordInput) return;

  message.textContent = 'Veuillez renseigner vos identifiants !';
  message.classList.add('error');
  message.hidden = false;

  const clearPassword = () => {
    passwordInput.value = '';
    passwordInput.setAttribute('autocomplete', 'new-password');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      message.textContent = 'Veuillez renseigner vos identifiants !';
      message.classList.add('error');
      message.hidden = false;
      return;
    }

    message.textContent = 'Vérification en cours...';
    message.classList.remove('error');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        clearPassword();
        throw new Error(data.message || 'Échec de connexion.');
      }

      sessionStorage.setItem('gestionStagiairesToken', data.token);
      sessionStorage.setItem('gestionStagiairesUser', JSON.stringify(data.user));
      emailInput.value = '';
      clearPassword();
      message.textContent = '';
      message.classList.remove('error');
      message.hidden = true;

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 180);
    } catch (err) {
      message.textContent = err.message;
      message.classList.add('error');
    }
  });
});