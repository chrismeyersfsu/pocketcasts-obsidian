# PocketSync

An [Obsidian](https://obsidian.md) plugin that syncs your [Pocket Casts](https://pocketcasts.com) listening history to Obsidian markdown notes.

## Features

- Sidebar panel showing your Pocket Casts listening history
- Filters to episodes you have completed or listened to for at least 5 minutes
- One-click note creation for any episode
- Rich frontmatter with episode metadata (title, podcast, author, duration, progress, artwork, and more)
- Optional [Templater](https://github.com/SilentVoid13/Templater) integration for custom note layouts
- Configurable note path and filename templates
- Automatic show notes fetched from Pocket Casts

## Requirements

- A Pocket Casts account (free or paid)
- Obsidian 1.0.0 or later

## Installation

### From the Community Plugins browser

1. Open **Settings > Community plugins** and disable Safe mode if prompted.
2. Click **Browse** and search for **PocketSync**.
3. Click **Install**, then **Enable**.

### Manual installation

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/chrismeyersfsu/pocketcasts-obsidian/releases/latest).
2. Copy the files to `<vault>/.obsidian/plugins/pocketsync/`.
3. Reload Obsidian and enable the plugin under **Settings > Community plugins**.

## Setup

1. Open **Settings > PocketSync**.
2. Enter your Pocket Casts **email** and **password**.
3. Optionally configure:
   - **Note path** — folder where episode notes are created (default: `personal/podcasts`)
   - **Note filename** — template using `{{podcast_name}}` and `{{podcast_episode}}` placeholders
   - **Templater template file** — path to a Templater `.md` template (without extension)

## Usage

Click the headphones icon in the ribbon or run **Open listening history** from the command palette to open the history panel.

Click any episode card to create a note for that episode. If the note already exists you can open the existing note, overwrite it, or cancel.

### Templater integration

If you have the Templater plugin installed and configure a template file, all episode metadata is available via `tp.frontmatter` in your template. A sample template is included in the [`templates/`](templates/Podcast.md) folder of this repository.

## Frontmatter fields

Each created note includes the following frontmatter:

| Field | Description |
|---|---|
| `podcast_title` | Name of the podcast |
| `episode_title` | Episode title |
| `author` | Episode author |
| `episode_uuid` | Pocket Casts episode ID |
| `podcast_uuid` | Pocket Casts podcast ID |
| `podcast_slug` | URL-friendly podcast identifier |
| `episode_slug` | URL-friendly episode identifier |
| `published_date` | Publication date |
| `duration_seconds` | Total duration in seconds |
| `duration_formatted` | Human-readable duration (e.g. `1h 23m`) |
| `played_up_to_seconds` | Seconds listened |
| `played_up_to_formatted` | Human-readable progress |
| `progress_percent` | Listening progress (0–100) |
| `completed` | `true` if fully listened |
| `playing_status` | Raw Pocket Casts playing status code |
| `starred` | `true` if starred in Pocket Casts |
| `audio_url` | Direct link to the audio file |
| `image_url` | Podcast artwork URL |
| `file_type` | Audio file MIME type (if available) |
| `file_size_bytes` | Audio file size in bytes (if available) |
| `episode_type` | Episode type, e.g. `full`, `trailer` (if available) |
| `season` | Season number (if available) |
| `episode_number` | Episode number (if available) |
| `description` | Show notes fetched from Pocket Casts |
| `tags` | Always set to `[podcast]` |

## License

MIT — see [LICENSE](LICENSE).
