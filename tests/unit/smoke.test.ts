import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_CONFIG } from '../../src/app/config/appConfig';
import { APP_ROUTES } from '../../src/app/routes/routes';

test('Smoke test: application configuration and route definitions', () => {
  assert.ok(APP_CONFIG.name);
  assert.equal(APP_CONFIG.name, 'PathFlow');
  assert.ok(APP_ROUTES.length > 0);
  assert.ok(APP_ROUTES.some((r) => r.id === 'dashboard'));
});
