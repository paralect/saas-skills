---
name: write-changelog
description: Write the next release note into the project's changelog, cut from the git history since the last note and written for the people who use the product, with a cover image drawn from the product's real interface. Matches the format of the notes already there, or starts a changelog when there is none. Use when asked to write, draft or add a changelog, a changelog entry, release notes, a release, an update, "what's new" or "what shipped".
---

# Write a changelog

You're adding one release note to the project's changelog: what changed since the last note, written for the people using the product, with a cover image of the product where the change lives.

Every file this skill uses ships in its own folder, next to this SKILL.md, and paths here are relative to that folder. It needs nothing from other skills or other folders, so don't go looking for them. Read these before writing:

- `references/changelog.md`: the folder layout, the frontmatter, what a release note looks like, starting a changelog.
- `references/writing.md`: the writing standard and the markers of AI writing to avoid.
- `references/release-images.md`: the cover image's composition, size and file. Read it before "Images".

## Which changelog

- The brief names a changelog, by name or folder: use it.
- `.paralect.json` at the project root lists changelogs under `content.changelogs`, each with a `dir` and a `name`. One: use it. Several: pick by fit and say which.
- Otherwise look for one: a folder of release notes named `changelog`, `changelogs`, `releases` or `release-notes` (often under `content/`, `src/content/` or the website's app folder). One per product: in a repo with several apps, use the one inside the app the commits change.
- None: start one, as `references/changelog.md` says under "Starting a changelog", write the note into it and say the changelog is new.

A single `CHANGELOG.md` at the root with version headings is a library's changelog, not this kind. Add a section to it in its own style only when the user asks for that file.

## What goes in the note

- Find the window. The latest note's `date` (and its last commit if it names one) is where this release starts. The brief may set a different range, a tag or a list of changes. Then:

  ```
  git log --no-merges --date=short --format='%h %ad %s%n%b' --shortstat --since=<date>
  git tag --sort=-creatordate
  ```

  When a commit message is too thin to write from, read the diff with `git show <hash>`.
- Write for the people using the product: what they can do now, what got faster, what stopped breaking, where to find it. Group related commits into one line. Leave out refactors, dependency bumps, CI, tests, docs-only edits and anything that doesn't change what a user sees. List what you left out in your reply, not in the note.
- One theme: the narrative shape (a title naming the feature, a paragraph on why it matters, `##` sections walking through it). Several unrelated changes: the grouped shape (`## New`, `## Improved`, `## Fixed`, skipping empty ones).
- Claim only what the commits show. Something that landed but is switched off (behind a flag, commented out, not linked anywhere) isn't in the note; mention it in your reply.
- Nothing users would notice since the last note: say so and stop. Never pad a note.
- Frontmatter and file name follow the folder's other notes: their keys (`title`, `description`, `date`, `draft` and whatever else they carry), their date format, MDX or Markdown. The date is today unless told. The slug is what the release is about (`custom-domains.mdx`), never a date, version or hash, unless every note in the folder is named that way.

## One note per theme

Keep a note to one theme: a feature, or 2 or 3 that belong together. Split a busy stretch into several notes rather than writing one long list; 2 notes with the same date are fine. Title each after its theme, and put small things that shipped alongside under `## Also new` in the note they fit best.

## Images

Every note gets a cover image, and a note with several features can get a screenshot for each one a reader has to find or set up, 2 or 3 at most. All of them are drawn from the product's real interface. No interface to show (a CLI, an API, a library): skip the images and say so.

### Find what the project already has

Before drawing anything, look for:

- **The project's notes on images:** a doc that says how its changelog images are made (search `agent_docs/`, `docs/`, `README`, `CLAUDE.md`, `AGENTS.md` for "changelog image", "cover", "render route"). When one exists, follow it over this section.
- **A render route:** a page like `/cover/<slug>` or `/changelog-image/<name>` that draws images from the product's own components. Add this note's scenes there instead of building a new one.
- **The last notes' images:** match them. Same stage, same insets, same window chrome, same frontmatter key (`coverImage`, `image`, `imageUrl` or `cover`).
- **Where images live:** a CDN host in the last notes' image URLs, or site paths like `/changelog/<slug>/cover.png` in the project's `public/` or `static/` folder.

### Build the images

No render route yet: build one in the project's own stack, following `references/release-images.md`. Make it one page, `noindex` and linked from nowhere, that takes an image name and renders one scene, with the scenes in a map and their demo data in a file of its own.

- **Cover:** 1200×630, captured at 2x. The screen where the change lives, in the app's own chrome, with the one piece the title names lifted out and enlarged.
- **Body screenshots:** one card, form or state, on the product's own background, cropped to its content and zoomed so text reads at about 800px wide. Don't repeat what the cover shows.
- **Real components only.** Render the product's components with static demo data. For a component that fetches its own data, seed the data layer it reads from (a React Query client seeded with `setQueryData` under the exact key the hook builds, a mocked store, a fixture provider) rather than redrawing it. A state that needs a click (a picked tab, a selected row) can be set by clicking after mount.
- **Demo data shaped like the API's output**, with believable rhythms: busy weekdays, quiet weekends, counts that add up. Never real users' data.

Capture with the script in this folder, with the dev server running (check the port really serves this project: `lsof -iTCP:<port> -sTCP:LISTEN` and the page title):

```bash
node <this skill folder>/scripts/capture.mjs --url http://localhost:<port>/<route>/<cover> --out out/write-changelog/<slug>/cover.png --wait 3500
node <this skill folder>/scripts/capture.mjs --url http://localhost:<port>/<route>/<shot> --out out/write-changelog/<slug>/<shot>.png --width 1600 --height 1400 --wait 3500
```

It screenshots the `[data-og-frame]` element, so a body shot is cropped to its frame. It installs Playwright into this folder on the first run. Open every PNG: nothing loading or half-animated, nothing clipped except the cover window's intended bleed, bars and numbers that make sense, and the focal piece is what the note's title names.

### Where the images go

A CDN is optional. Use it when the project has one set up, and keep the images in the repository when it doesn't.

**The project has a CDN** (the last notes' images point at one, and the upload settings are in the environment or the project's `.env` / `.env.local`): upload with the script in this folder, from the project root:

```bash
node <this skill folder>/scripts/upload-to-cdn.mjs <prefix>/changelog/<slug> out/write-changelog/<slug>/*.png
```

It works with any S3-compatible bucket (Cloudflare R2, AWS S3, MinIO, Garage) and reads `CDN_ENDPOINT` (for R2 `https://<account-id>.r2.cloudflarestorage.com`), `CDN_BUCKET`, `CDN_ACCESS_KEY_ID`, `CDN_SECRET_ACCESS_KEY`, `CDN_PUBLIC_URL`, and `CDN_REGION` for S3 (R2 uses `auto`, the default). `<prefix>` is the project's name, or whatever folder the last notes' URLs use. It prints each file's public URL with its HTTP status, which must be 200. Never print, paste or commit the credentials, and don't hunt for them anywhere else.

**No CDN:** copy the images into the app that publishes the changelog, at `<static>/changelog/<slug>/<name>.png` (`<static>` is its `public/` or `static/` folder), and point the note at site paths like `/changelog/<slug>/cover.png`. That's the default, and it's done: don't ask for a bucket. Mention in your reply that the `CDN_*` variables above would move the images out of the repository on the next run.

**Published somewhere that can't load the site's paths** (a changelog on another domain, like Relay): the note needs full URLs. Use the CDN when there is one. Without it, an upload tool the session has (Relay's `upload_image`) is the next choice; otherwise keep the site paths and say in your reply which images still need hosting.

Then write the images into the note: the cover under the folder's image key in the frontmatter (`coverImage` if no note has one yet), and each body screenshot as a Markdown image right under the paragraph about its feature, with alt text that says what's on screen:

```mdx
![The report form: #growth, weekly, last week, 09:00 Europe/Warsaw](/changelog/<slug>/report-form.png)
```

### Leave notes for the next run

When you build the render route, or learn something about it the hard way, write it down in the project where the next run finds it: its `agent_docs/` (or `docs/`) under a name like `changelog_images.md`, linked from the index in `AGENTS.md` or `CLAUDE.md` if there is one. Cover where the route and its files are, the image names so far, how to add a scene, the capture commands, where the images go, and each pitfall you hit. Project specifics go there, not in this skill.

## Finish

Check the frontmatter parses and the note doesn't name files, hashes, internal modules or ticket ids. Links to the product's docs or pages are full URLs when the changelog publishes on another domain. Reply with:

- The note's path relative to the project root, and where every image is (its URL or path).
- The window it covers: the first and last commit.
- The commits you treated as internal, as `hash subject`.
- Anything to check before publishing: a claim you were unsure of, a change that landed switched off.
