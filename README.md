# Aditya More Applied AI Portfolio

A clean Next.js portfolio for an Applied AI Engineer, backed by Sanity Content Lake and an embedded Sanity Studio at `/studio`.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Sanity CMS
- `next-sanity`
- Embedded Sanity Studio
- ISR with `revalidate = 60`
- Vercel-compatible deployment

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Sanity project:

   ```bash
   npm create sanity@latest
   ```

   You can create only the project in Sanity, then use this repository's Studio configuration instead of the generated app.

3. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

4. Fill in:

   ```bash
   NEXT_PUBLIC_SANITY_PROJECT_ID=your_sanity_project_id
   NEXT_PUBLIC_SANITY_DATASET=production
   NEXT_PUBLIC_SANITY_API_VERSION=2025-05-01
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open:

   - Portfolio: `http://localhost:3000`
   - Sanity Studio: `http://localhost:3000/studio`

## Docker Services (vLLM + Qdrant)

The portfolio assistant requires a local LLM server and a vector store. Start them with:

```bash
docker compose up -d
```

This starts:
- **vLLM** on `localhost:8000` — OpenAI-compatible LLM server (serves `Qwen/Qwen3-4B-Instruct`)
- **Qdrant** on `localhost:6333` — vector store for semantic search

vLLM auto-downloads the model from HuggingFace on first start (requires ~8GB GPU memory).

### Run the app

```bash
npm run dev
```

Open `http://localhost:3000` — the portfolio assistant in the chat panel uses vLLM via the streaming pipeline.

### Index portfolio content (first time only)

```bash
npm run index-content
```

This embeds portfolio data into Qdrant for semantic search. Embeddings run locally via `sentence-transformers` (transformers.js) — no separate server needed.

## Full Sanity Setup To See Portfolio Data

Follow these steps when the homepage shows:

```text
Portfolio content is ready for Sanity.
Configure the Sanity environment variables and add the initial site settings document in Studio to publish the live portfolio content.
```

That message means the Next.js app is running, but the public frontend query did not find a published `siteSettings` document.

### 1. Confirm Your Sanity Project ID

The project ID is not the project name. It is usually a short generated ID such as `u9fc4ayx`.

Check your projects:

```bash
npx sanity login
npx sanity projects list
```

Copy the `id` value from the correct project into `.env.local`:

```bash
NEXT_PUBLIC_SANITY_PROJECT_ID=your_actual_project_id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2025-05-01
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. Create Or Confirm The Dataset

List datasets:

```bash
npx sanity dataset list
```

If `production` is missing, create it:

```bash
npx sanity dataset create production --visibility public
```

### 3. Add Localhost To Sanity CORS

In Sanity Manage:

1. Open your project at `https://www.sanity.io/manage`
2. Go to **API**
3. Add this CORS origin:

   ```text
   http://localhost:3000
   ```

4. Enable **Allow credentials**
5. Save

You can also add it from the terminal:

```bash
npx sanity cors add http://localhost:3000 --credentials
```

### 4. Import Starter Portfolio Content

This repository includes starter published content in `sanity/seed.ndjson`.

Import it into the configured dataset:

```bash
npx sanity dataset import sanity/seed.ndjson production --replace
```

This creates initial published documents for:

- Site settings
- Experience
- Projects
- Skill categories
- One optional technical note

### 5. Verify Published Content Exists

Run:

```bash
npx sanity documents query '*[_type == "siteSettings"][0]{_id,name,role}' --api-version 2025-05-01
```

Expected result:

```json
{
  "_id": "siteSettings.aditya-more",
  "name": "Aditya More",
  "role": "Applied AI Engineer"
}
```

If this returns nothing, the CMS is still empty or you are logged into the wrong Sanity project.

### 6. Start The Portfolio Site

If another process is already using port `3000`, stop it first:

```bash
pkill -f "next dev"
```

Then start the app:

```bash
npm run dev
```

Open:

- Portfolio: `http://localhost:3000`
- Studio: `http://localhost:3000/studio`

### 7. Edit And Publish From Studio

Open `http://localhost:3000/studio`, log in, then edit documents such as:

- Site Settings
- Experience
- Projects
- Skill Categories
- Technical Notes

For every change you want visible on the website, click **Publish** in Studio. Draft-only changes do not appear on the public homepage.

### 8. If The Homepage Still Looks Empty

Check these common causes:

- `.env.local` has the wrong `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `.env.local` has a dataset name that does not exist
- `siteSettings` exists only as a draft and was not published
- Content was imported into a different Sanity project or dataset
- The dev server was not restarted after changing `.env.local`

After changing `.env.local`, restart:

```bash
pkill -f "next dev"
npm run dev
```

## Import Starter Content

Starter documents are included in `sanity/seed.ndjson`.

After configuring `.env.local` and logging in to Sanity, import them with:

```bash
npx sanity dataset import sanity/seed.ndjson production --replace
```

Then open `/studio` to edit:

- About section
- Professional summary
- Experience
- Projects
- Skills
- Resume file or URL
- Contact information
- Social links
- CTA text
- Hero metrics
- Technical notes

## Resume Management

The site prefers the uploaded Sanity `resumeFile` when present. If no file is uploaded, it uses `resumeUrl`.

For local starter content, `resumeUrl` points to `/resume-placeholder.pdf`. Replace it in Studio with either:

- An uploaded PDF file
- An external PDF URL

## Projects and Screenshots

Each project supports:

- Title and slug
- Summary
- Cover image
- Technology tags
- Key metrics
- GitHub and demo links
- Problem, approach, results, limitations, future improvements
- Architecture image
- Screenshots
- Portable Text rich content

Featured projects appear on the homepage. All published project pages are available at `/projects/[slug]`.

## Technical Notes

Technical notes are optional. Featured notes with a published date appear on the homepage, and detail pages are available at `/notes/[slug]`.

## Vercel Deployment

1. Push this repo to GitHub.
2. Create a Vercel project from the GitHub repo.
3. Add these environment variables in Vercel:

   ```bash
   NEXT_PUBLIC_SANITY_PROJECT_ID
   NEXT_PUBLIC_SANITY_DATASET
   NEXT_PUBLIC_SANITY_API_VERSION
   NEXT_PUBLIC_SITE_URL
   ```

4. Set `NEXT_PUBLIC_SITE_URL` to your deployed Vercel URL, for example:

   ```bash
   https://your-project.vercel.app
   ```

5. Deploy.

## Sanity CORS

In Sanity Manage, add CORS origins for:

- `http://localhost:3000`
- Your Vercel deployment URL, for example `https://your-project.vercel.app`

Enable credentials for Studio authentication.

## Content Refresh

Pages use Incremental Static Regeneration:

```ts
export const revalidate = 60;
```

Published CMS changes should appear on the live website within about one minute without source-code edits or manual redeployment.

For instant refreshes later, add a Sanity webhook and a Next.js on-demand revalidation route.

## Validation

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Notes

No custom backend, external database, or write token is required for the public portfolio. Published content is read from Sanity Content Lake.
