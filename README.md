<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e70f375f-a99d-4a66-81e6-9da01e2b1f2b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Split3MF is now the default workflow

`/` redireciona para **[/split-3mf](http://localhost:3000/split-3mf)** — importe 3MF/GLB/OBJ
coloridos, segmentação automática por cor, editor de fronteira por pincel, 5 cap methods,
4 connector types e export multi-cor em 3MF/GLB/OBJ/STL. 100% client-side, zero upload.

- Fluxo legado de pintura manual continua em `/viewer3d`.
- TDD: [`docs/tdd/SPLIT3MF_V2_REVIVAL.md`](docs/tdd/SPLIT3MF_V2_REVIVAL.md)
- Testes: `npm test` (unit) · `npm run test:e2e` (Playwright)
