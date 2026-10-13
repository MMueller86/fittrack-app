import { describe, expect, it } from 'vitest';
import { PROFILE_TAB_LABEL, PROFILE_TAB_ROUTE } from './profileTab';

describe('profileTab', () => {
  it('keeps the tab label "Profil" and the route id "Profile"', () => {
    expect(PROFILE_TAB_LABEL).toBe('Profil');
    expect(PROFILE_TAB_ROUTE).toBe('Profile');
  });
});
