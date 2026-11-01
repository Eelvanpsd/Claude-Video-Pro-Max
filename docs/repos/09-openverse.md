# openverse — WordPress/openverse

> Source (vendored): [`repos/openverse`](../../repos/openverse) · License: **MIT** (code; every media item keeps its own CC licence) · Verdict: ✅ **Adopt as the SFX sourcing step** (use the public API, not the self-hosted stack)

## What it is
The monorepo behind [openverse.org](https://openverse.org), WordPress's search engine for openly licensed media
(images and audio). It is a whole data platform, not a video tool:

| Part | What | Where |
|---|---|---|
| Catalog | Apache Airflow DAGs that crawl providers (Freesound, Jamendo, Wikimedia Commons, ccMixter, …) into Postgres | `catalog/` |
| Ingestion server / indexer | Copies the catalog into Elasticsearch | `ingestion_server/`, `indexer_worker/` |
| API | Django REST API: `/v1/audio/`, `/v1/images/`, licence + category filters, waveforms | `api/` |
| Frontend | Nuxt/Vue site at openverse.org | `frontend/` |

For a video pipeline the useful piece is the **public audio API**: one query returns real recordings with licence,
creator, attribution text, duration and a direct file URL — mostly Freesound uploads.

## How to run
Self-hosting needs Docker + `just` + Airflow + Elasticsearch (`just up`, see `documentation/`). Not worth it for
sourcing SFX — call the hosted API:

```bash
# CC0 only, sound effects, short clips
curl -s "https://api.openverse.org/v1/audio/?q=page%20turn&license=cc0&category=sound_effect&length=shortest&page_size=20"
# one item (licence, creator, attribution, file url, duration in ms)
curl -s "https://api.openverse.org/v1/audio/<id>/"
# waveform peaks for a quick look without downloading
curl -s "https://api.openverse.org/v1/audio/<id>/waveform/"
```

Filters (from `api/api/serializers/audio_serializers.py`, `api/api/constants/field_values.py`):
`license` (`cc0`, `pdm`, `by`, …), `license_type` (`commercial`, `modification`), `category`
(`sound_effect`, `music`, `podcast`, `audiobook`, `news`, `pronunciation`), `length`
(`shortest`, `short`, `medium`, `long`), `source` (`freesound`, `jamendo`, `wikimedia_audio`, …), `page_size`.

## What we measured (2026-11-02)
- `q=paper tear&license=cc0` → 240 hits (the anonymous cap), e.g. "Packaging Paper Tear Short.wav" (0.37 s, freesound).
- `q=chime&license=cc0` → 240 hits, e.g. "Chime Notification" (0.32 s, freesound).
- `duration` is in **milliseconds**. Many items have no `category`, so `category=sound_effect` can return 0 for a query
  that has plenty of CC0 hits — drop the category filter and filter by `duration` yourself.
- The hosted API returned **HTTP 504** on some requests: retry with a back-off.
- Code defaults for anonymous clients are tight (`5/hour` burst, `100/day` in `api/conf/settings/rest_framework.py`;
  live values are set by env). A free registered app (`POST /v1/auth_tokens/register/`) gets `100/min`, `10000/day`.

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Licence-first search** | Filter to CC0 / PDM at the source so no attribution or share-alike can leak into a monetised video | API `license=cc0` |
| Attribution text | Each result carries `attribution` + `creator` + `foreign_landing_url`: store them in a manifest even for CC0 | API response |
| Pick before download | `waveform/` peaks + `duration` let an agent shortlist (short, single transient) before fetching | `/v1/audio/<id>/waveform/` |
| Provenance | `source` + `foreign_landing_url` show where the file really lives (re-check the licence on Freesound itself) | API response |

## Free vs paid
Free. Hosted API, no key needed (registration is free and raises limits). Self-hosting is free but heavy.

## Adopt
1. ✅ **CC0 SFX sourcing**: search Openverse first (`license=cc0`, short `duration`), download, write a manifest row
   (`id`, `title`, `creator`, `license`, `foreign_landing_url`) — feeds the library that [real-sfx](11-real-sfx.md)
   and [earshot](10-earshot.md) work on.
2. ✅ Re-check each licence on the landing page before use → [QUALITY-CHECKLIST](../QUALITY-CHECKLIST.md) › Audio.

## Skip
- Self-hosting the catalog/API/frontend stack: a data platform, no gain for a video pipeline.
- `music` category for beds: licences are mixed (BY, BY-SA, NC) — only CC0/PDM if the video is monetised.
