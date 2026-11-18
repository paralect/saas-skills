# Changelog

One note per release, in a folder, read newest first. Each note has its own address (`<site>/changelog/<slug>`) with a title, description and cover, so it can be linked from a tweet or a customer email.

## Layout

```
changelog/
  custom-domains.mdx
  changelogs.mdx
  build-tab-and-team.mdx
```

Flat, one file per release, the file name is the slug: what the release is about, not its date or version (`custom-domains`, not `2026-09-19` or `v0-4-0`). Releases sort by `date`. Images at `<static>/changelog/<slug>/<name>.png`, or on the project's CDN.

**One changelog per product.** A repository that ships two products (an app and the hosted service next to it, say) keeps one changelog for each, in its own folder, usually inside the app it describes (`apps/web/changelog`). A release that touches both gets a note in each, each saying only its product's side.

## Frontmatter

```yaml
---
title: Changelogs
description: A new Content space for release notes, edited like a blog and read on one scrolling page.
date: 2026-09-19
coverImage: /changelog/changelogs/cover.png
draft: false
---
```

`title`, `description`, `date` on every release, and `coverImage` for its cover. `draft: true` for a note written ahead of its release. A folder whose notes carry other keys (`version`, `category`, `author`, `publishedAt` in place of `date`) keeps them, in their order and format.

## What a release note looks like

The title names the feature, the first paragraph says what shipped and why it matters, `##` headings walk through it from the user's side, and it ends with where to find it. It's written for the people using the product, not the people who built it.

```mdx
---
title: Changelogs
description: A new Content space for release notes, edited like a blog and read on one scrolling page.
date: 2026-09-19
coverImage: /changelog/changelogs/cover.png
---

Every product needs a place to say what shipped. Paralect Agent now has one: a **changelog** is a third kind of Content space, next to blogs and Help Centers. It's a folder of `.mdx` files in the repository, one per release, with a title, a date and a note.

## Editing

In Paralect Agent a changelog works like a blog. Releases are listed newest first in the sidebar, each opens in the same editor as a post, and the Claude panel next to it can draft the note for you. Releases can be drafts until you flip the publish switch.

Add one under _Settings → Content → Changelogs_. The folder is recorded in `.paralect.json`, so everyone opening the repository gets the same space.

## Reading

Published, a changelog is one long page: the date sits in a column on the left, the release on the right, and older releases load as you scroll. Each release still has its own address at `<site>/changelog/<slug>`.
```

A release with several unrelated changes uses the grouped shape instead: one or two sentences on the theme, then `## New`, `## Improved`, `## Fixed`, skipping any that would be empty, each bullet one user-facing change with related commits merged into one line. A bold lead-in names the change, the rest of the bullet says what the user gets:

```mdx
## New

- **Sort groups by net revenue.** The groups table can be sorted by net revenue again.

## Fixed

- Popovers and confirm dialogs no longer open behind side sheets on mobile.
```

Either way: no commit hashes, file names, refactors, dependency bumps or internal chores unless they change what the user sees. Name the setting or screen where the change lives, in the product's own words. Numbers where they exist ("loads in under a second", "up to 20 members").

## Adding a release to an existing changelog

Read the last 2 or 3 notes for the shape, the keys and the length, and open their images to match the composition. Write the new note from `git log` since the last note's date (and since its last commit, if the note names one). Date it today unless told otherwise. If the project renders its covers from a route (`/cover/<slug>`), add the new release's scene there and render it with the others.

A gap of several weeks with commits and no note: write one note per theme that shipped, each dated by its last commit, rather than one note for the lot.

## Starting a changelog

No changelog yet: put the folder next to the project's other content (`content/changelog`, or `changelog/` inside the app that has the marketing site), and use MDX files with the frontmatter above. If the project has a `.paralect.json`, register it:

```json
{ "content": { "changelogs": [{ "dir": "content/changelog", "name": "Changelog" }] } }
```

The first notes come from the repository's history. Read it before writing:

```
git tag --sort=-creatordate
git log --no-merges --date=short --format='%ad %s%n%b' --shortstat
```

- **Tagged releases**: one note per tag, from the commits between it and the previous tag. Title the note after what the tag shipped, not the version number; the version can go in the first sentence.
- **No tags**: group the commits into releases by what shipped together. A feature that landed over a week of commits is one release. Aim for 3 to 6 notes covering the history that matters; the early "initial commit" stretch folds into one "first release" note that says what the product does. Date each note by its last commit.
- **A history too short to split**: one note, dated today, titled after the product, saying what it does and what's in it.

When the user asked for one note, write only the latest release and say the rest of the history can be seeded the same way.
