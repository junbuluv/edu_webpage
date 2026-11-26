import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retiredCourseRedirect } from './retired-routes.ts';

const HOME = '/?from=eco-1002';

test('old ECO 1002 addresses go to the home page with a note', () => {
  for (const path of [
    '/eco-1002',
    '/eco-1002/',
    '/eco-1002/workshops',
    '/eco-1002/archive',
    '/eco-1002/instructors/some-name',
    '/macro',
    '/macro/',
    '/lessons/eco-1002/is-lm-intro',
    '/lessons/eco-1002/solow/',
    '/lessons/eco-1002',
    '/practice/eco-1002-ad-as',
    '/workshops/eco-1002-phillips-curve',
  ]) {
    assert.equal(retiredCourseRedirect(path), HOME, path);
  }
});

test('other addresses are left alone', () => {
  for (const path of [
    '/',
    '/eco-10021',
    '/macroeconomics',
    '/fin-3610',
    '/lessons/fin-3610/capm-and-sml',
    '/practice/fin-3610-case-beta-sampling',
    '/practice/eco-1002',
    '/workshops/fin-3610-npv',
    '/instructor/classes/eco-1002',
  ]) {
    assert.equal(retiredCourseRedirect(path), null, path);
  }
});
