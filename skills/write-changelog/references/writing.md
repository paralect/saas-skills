# How the pages read

The standard the pages are held to. It's Paralect's own: their "How to write great content" guide and "Signs of AI slop in writing" post, which paralect.com's blog, academy and stack are written by.

## Before writing a page

- **Know the goal.** Every page leads somewhere: a reader who finishes a help page can do the thing; a blog post ends where the reader acts on it; a changelog note tells them what to try.
- **Start from facts.** Numbers, dates, names, links, what the code does, what happened in the commits. A page with no facts in it is filler. When a fact is missing, leave it out and say so in the summary; never invent it.
- **Pick the reader.** Write to one specific person: the developer setting the product up, the founder deciding on a tool, the customer who just hit the error. Not "users".

## Sentences

- Simple words, 7th-grade level. Short sentences. Cut every word that doesn't add meaning; adjectives first.
- Talk to the reader: "you", not "we" or "users". Start with a verb where you can ("Open the settings", not "The settings can be opened").
- Numbers as digits: 7, not seven. Specific beats vague ("takes about ten minutes", "$200/month for a year").
- One idea per paragraph, 2 to 4 sentences. Then a heading, a list, a table, an image. No text blobs.
- Read it back: anything you wouldn't say to a client on a call gets rewritten.

## Structure

- **Titles carry the page.** Short, specific, promising something: "Connect paths with Cloudflare", "How to build an MVP in 2026", "Signs of AI slop in writing". Not "Overview", "Introduction", "Getting started with X" (unless it is literally the first-run guide).
- **Headings are the table of contents.** A reader who only reads the headings should know what the page covers and in what order. Numbered headings for procedures (`## 1. Set the paths`).
- Lead with the point. The first paragraph says what the page is about and who it's for; no warm-up.
- Formatting for reading, not decoration: bold the term being defined or the UI label being clicked (**Settings → Domain**), code for anything typed (`npm run dev`, file names, keys), a table when items share fields.

## Voice

- Authentic and specific: real product names, real people, real numbers, screenshots of the real screen. Opinions are welcome where the kind allows it (a blog, a stack page's "when not to use"): say what's right and wrong and why.
- Plain about limits and failures. A help page names what the feature can't do; a changelog says what was broken.
- The product's own words for its concepts. If the app says "workspace", the pages say workspace.

## Markers of AI writing to avoid

Readers file a page as AI slop the moment they see these. None of them, anywhere:

1. **"It's not X, it's Y."** ("It's not a feature, it's a paradigm shift.") Say the thing.
2. **Numbers spelled out**, or oddly specific counts where a plain word would do.
3. **AI vocabulary**: delve, leverage, navigate, elevate, intricate, meticulously, synergy, empower, landscape, ecosystem, underscore, seamless, robust, game-changer, streamline, unlock, harness, supercharge. And ad words: boasts, vibrant, nestled, renowned, groundbreaking, committed to, showcasing, a diverse array of, cutting-edge, state-of-the-art.
4. **Fake questions** used as structure. ("Why does it matter? Speed compounds.")
5. **Connectors on every sentence**: additionally, furthermore, moreover, however, importantly, notably, crucially.
6. **Drama and bait**: "this changes everything", "the future is here", "a paradigm shift".
7. **Title Case Headings** in the body. Sentence case.
8. **Forced lists inside paragraphs**: "There are three reasons. First… Second… Third…"
9. **Name-dropping** press and big brands as decoration.
10. **Typographic flourishes**: em dashes (—) everywhere, curly quotes, ellipsis characters. Commas, periods, colons and parentheses do the work. Straight quotes.

Also: no emoji in headings or as bullets (an emoji as a page `icon` is fine), no exclamation marks, no "In this article, we will", no closing "In conclusion" or "Happy coding!", no hedging ("it's worth noting that", "it's important to remember").

## By kind, in one line each

- **Blog post**: promise in the title, deliver it in the body, end with one plain call to action that fits the topic.
- **Help page**: what the reader will be able to do, then the steps, then what can go wrong.
- **Directory item**: what it is in one sentence, then when to use it and when not to, with the trade-offs named.
- **Changelog note**: what changed for the person using the product, grouped as new, improved, fixed. No commit hashes, file names or refactors.
