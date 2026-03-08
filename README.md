# Ramayana Website

Static website to browse Valmiki Ramayana by Kanda -> Sarga (chapter) -> Shloka, including English meaning/explanation from an open dataset.

## Included Content

- 7 Kandas
- 648 Sargas (chapters)
- 23,402 Shlokas with English meaning/explanation

## Run Locally

Use any local static server from this directory, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Data Source

- Dataset: https://github.com/AshuVj/Valmiki_Ramayan_Dataset
- Local build script: `scripts/build-data.mjs`
- Raw input: `raw/Valmiki_Ramayan_Shlokas.json`
- Generated JSON: `data/`

## GitHub Pages Deployment

The workflow file `.github/workflows/deploy-pages.yml` deploys this site automatically on pushes to `main`.

## Notes

This project uses available shloka text and English meaning fields from the source dataset. If the upstream dataset is updated, rerun:

```bash
node scripts/build-data.mjs
```
