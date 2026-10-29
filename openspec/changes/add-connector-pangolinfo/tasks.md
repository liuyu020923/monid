# Tasks

- [x] Fork upstream and create an isolated connector branch.
- [x] Verify native API contracts and current provider point prices.
- [x] Implement provider auth, business-status handling and receipt settlement.
- [x] Add ten bounded endpoints and stable endpoint aliases.
- [x] Add compiled-artifact request, billing and input boundary tests.
- [x] Fix CLI repository-root conversion for Windows.
- [x] Update endpoint identity lock.
- [x] Record real provider responses and replay sanitized fixtures.
- [x] Run repository typecheck, compile, full tests, format, lint and identity checks.
      Full suite: 1319 passed, 0 failed, 222 credential-gated cases ignored.
      Global identity check reports 78 pre-existing additions and 7 renamed or
      missing upstream identities; all ten Pangolinfo IDs match the lock. Only
      this connector's IDs were added to avoid rewriting other providers.
- [x] Document official-portal onboarding: Monid registers its own dedicated
      account at https://tool.pangolinfo.com/, obtains its permanent API Key,
      funds the account and configures hosted credentials.
- [ ] Monid accepts the proposed prepaid arrangement, provisions its account,
      confirms endpoint access/concurrency and configures the production key.
- [ ] Agree the public point-to-dollar rate and complete hosted acceptance
      before production activation.

Git commits and upstream PR submission remain owner-controlled operations.
