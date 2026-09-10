/**
 * Bootstrap for the standalone editor page (`libs/editor/index.html`).
 *
 * Config and task are not passed here on purpose: `configureStore()` fills them from
 * `env/development.js#getExample()`, so you switch the example you work on by changing
 * the `data` constant in that file.
 *
 * Cypress boots LSF itself and sets `DISABLE_DEFAULT_LSF_INIT` on `window:before:load`.
 * @see tests/integration/support/e2e.ts
 */
import "./standalone.js";

if (!window.DISABLE_DEFAULT_LSF_INIT) {
  // interfaces come from `defaultOptions`
  new window.LabelStudio("label-studio", {
    user: { id: 1, firstName: "Dev", lastName: "User" },
  });
}
