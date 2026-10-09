import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { button, field } from '../ui/components.js';

export function loginPage(container, params, query, app) {
  const password = h('input', { type: 'password', autocomplete: 'current-password', required: true, autofocus: true });
  const message = h('p', { class: 'error-box', role: 'alert', hidden: true });
  const submit = button('Sign in', { variant: 'primary', type: 'submit' });

  const form = h('form', {
    class: 'login',
    onsubmit: async (event) => {
      event.preventDefault();
      submit.disabled = true;
      message.hidden = true;
      try {
        await api.login(password.value);
        app.signedIn(query.get('next'));
      } catch (error) {
        message.textContent = error.code === 'bad_password' ? 'Wrong password' : error.message;
        message.hidden = false;
        password.select();
      } finally {
        submit.disabled = false;
      }
    },
  },
    h('h1', { text: 'Sign in' }),
    field('Password', password),
    message,
    submit,
  );

  replace(container, form);
  password.focus();
}
