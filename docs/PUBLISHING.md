# Publishing `ontologyviewer`

## Prerequisites

- The standalone repository is public so npm can attach provenance.
- `package.json.repository.url` exactly matches that public GitHub repository. Remove the `directory` field if `webplugin/` has become the repository root.
- Maintainers use npm 2FA. Release CI uses a GitHub-hosted runner, Node 24, and npm 11.5.1 or newer.
- Recheck `npm view ontologyviewer`; the name was unregistered when this project was planned, but availability can change.

## Bootstrap release

Trusted Publisher settings are attached to an existing npm package. For the first release:

```bash
npm ci
npx playwright install chromium firefox webkit
npm run verify:full
npm pack --dry-run
npm login
npm publish --access public
```

Complete npm's interactive 2FA. Never put a personal/automation token in the repository or workflow.

## Configure Trusted Publishing

On npmjs.com, open the package's **Trusted Publisher** settings and authorize:

- Provider: GitHub Actions
- GitHub owner/repository: the final public standalone repository
- Workflow filename: `webplugin-publish.yml`
- Environment: `npm-publish`
- Allowed action: `npm publish` (or stage-only if using npm staged publishing)

Create the protected `npm-publish` GitHub Environment, require reviewers, and protect release tags. After OIDC succeeds, configure npm publishing access to require 2FA and disallow traditional tokens.

## Release

1. Update CHANGELOG and version without creating an automatic tag:
   ```bash
   npm version patch --no-git-tag-version
   ```
2. Run `npm ci && npm run verify:full && npm pack --dry-run`.
3. Commit and merge the release change.
4. Create and push an exact version tag:
   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```
5. The workflow verifies `v${package.version}`, reruns every gate, requests an OIDC token only in the protected publish job, and runs `npm publish --access public`. Trusted Publishing adds provenance automatically.

The workflow intentionally contains no `NODE_AUTH_TOKEN` or npm secret.

## Verify npm and jsDelivr

```bash
npm view ontologyviewer@0.1.1 version dist.integrity repository
npm pack ontologyviewer@0.1.1 --dry-run
```

Then test:

```text
https://cdn.jsdelivr.net/npm/ontologyviewer@0.1.1/dist/ontologyviewer.esm.min.mjs
https://cdn.jsdelivr.net/npm/ontologyviewer@0.1.1/dist/ontologyviewer.css
```

Use an exact version in release validation. CDN propagation can take a short time.

## Recovery

Published versions are immutable. Do not reuse a version or silently replace files. If a release is bad, deprecate it with a clear message, publish a corrected patch, and document the incident. Use `npm unpublish` only when npm policy and a severe security incident require it.
