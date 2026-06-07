(async () => {
  const { data: { session } } = await sb.auth.getSession();
  const onLoginPage = location.pathname.endsWith('index.html') || location.pathname === '/';

  if (session && onLoginPage) {
    location.href = 'dashboard.html';
    return;
  }
  if (!session && !onLoginPage) {
    location.href = 'index.html';
    return;
  }

  if (session) {
    const { data: profile } = await sb
      .from('profiles')
      .select('full_name, role')
      .eq('id', session.user.id)
      .single();

    const nameEl = document.getElementById('user-name');
    const badgeEl = document.getElementById('user-role-badge');
    if (nameEl && profile) nameEl.textContent = profile.full_name || session.user.email;
    if (badgeEl && profile) {
      badgeEl.textContent = profile.role;
      badgeEl.classList.add('badge-' + profile.role);
    }
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      const errEl = document.getElementById('auth-error');
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      btn.textContent = 'Signing in…';
      btn.disabled = true;
      errEl.classList.add('hidden');

      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        errEl.textContent = error.message;
        errEl.classList.remove('hidden');
        btn.textContent = 'Sign In';
        btn.disabled = false;
      } else {
        location.href = 'dashboard.html';
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await sb.auth.signOut();
      location.href = 'index.html';
    });
  }

  const forgotLink = document.getElementById('forgot-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const successEl = document.getElementById('auth-success');
      const errEl = document.getElementById('auth-error');
      if (!email) {
        errEl.textContent = 'Enter your email above first.';
        errEl.classList.remove('hidden');
        return;
      }
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + '/index.html'
      });
      if (error) {
        errEl.textContent = error.message;
        errEl.classList.remove('hidden');
      } else {
        successEl.textContent = 'Password reset email sent! Check your inbox.';
        successEl.classList.remove('hidden');
      }
    });
  }
})();