---
title: Reproducible Hexo Deployment with GitHub Actions
date: 2026-08-27 19:30:00
updated: 2026-08-28 18:00:00
layout: post
lang: en
translation: /posts/2026/08/reproducible-hexo-deployment/
type: english-post
description: Build a stable, auditable Hexo publishing pipeline with lockfiles and GitHub Actions instead of relying on one developer machine.
featured: true
comments: false
---

Deploying a static blog should not depend on an environment that happens to work on one computer. Anyone with the repository should be able to run the same command and produce the same site structure, while every release remains traceable to a specific commit.

This article uses Hexo and GitHub Pages to build a publishing path that is intentionally simple and suitable for long-term maintenance.

<!-- more -->

## Define the build boundary first

The source branch keeps only three kinds of material:

- Markdown content and static assets
- Hexo, theme, and plugin configuration
- Dependency lockfiles and CI workflows

The generated `public/` directory does not belong in the source history. It can always be recreated, and committing it alongside the source usually produces duplicate history and avoidable merge conflicts.

```gitignore
node_modules/
public/
db.json
```

## Lock dependencies, not a particular computer

Use `npm install` for the initial local installation and commit the resulting `package-lock.json`. Continuous integration should then use:

```bash
npm ci
npm run build
```

`npm ci` follows the lockfile exactly. If `package.json` and the lockfile disagree, the build fails early. That failure is useful because it exposes an inconsistent release before publication.

Keep one clear build entry point in `package.json`:

```json
{
  "scripts": {
    "build": "hexo clean && hexo generate"
  }
}
```

Cleaning before generation prevents removed pages or stale Hexo state from leaking into a new release.

## Let automation do only a few things

An understandable pipeline is usually more reliable than a clever one. It should:

1. Install the locked dependencies.
2. Generate the static site.
3. Publish the generated files to the branch served by GitHub Pages.

```yaml
- uses: actions/setup-node@v7
  with:
    node-version: 24
    cache: npm
- run: npm ci
- run: npm run build
```

The workflow uses GitHub’s short-lived repository token. There is no personal access token stored in the repository and no dependency on a developer workstation.

## The most common configuration mistake: `root`

GitHub Pages commonly serves one of two URL shapes:

- User site: `https://user.github.io/`, with `root: /`
- Project site: `https://user.github.io/repository/`, with `root: /repository/`

When `root` is wrong, the HTML may load while CSS, JavaScript, and article links all point to the wrong location. Theme assets should go through Hexo’s `url_for()` helper instead of using handwritten absolute paths.

## Run a minimum verification before publishing

Build and serve the site locally:

```bash
npm run build
npx hexo server
```

Then verify that:

- The home page, article pages, and 404 page exist.
- CSS, JavaScript, and the favicon return successfully.
- `sitemap.xml` and `atom.xml` are generated.
- No development URL or local filesystem path remains in the output.
- Mobile navigation, theme switching, and code copying work.

## Conclusion

Reproducible deployment is mainly about reducing hidden state. Lock dependencies, define the build with one command, use short-lived credentials, and treat generated output as disposable.

When publishing becomes pleasantly boring, the author can give their attention back to the writing.
