---
podcast_title: <% tp.frontmatter.podcast_title %>
episode_title: <% tp.frontmatter.episode_title %>
author: <% tp.frontmatter.author %>
episode_uuid: <% tp.frontmatter.episode_uuid %>
podcast_uuid: <% tp.frontmatter.podcast_uuid %>
published_date: <% tp.frontmatter.published_date %>
duration_seconds: <% tp.frontmatter.duration_seconds %>
duration_formatted: <% tp.frontmatter.duration_formatted %>
played_up_to_seconds: <% tp.frontmatter.played_up_to_seconds %>
played_up_to_formatted: <% tp.frontmatter.played_up_to_formatted %>
progress_percent: <% tp.frontmatter.progress_percent %>
completed: <% tp.frontmatter.completed %>
playing_status: <% tp.frontmatter.playing_status %>
audio_url: <% tp.frontmatter.audio_url %>
episode_url: <% tp.frontmatter.episode_url %>
image_url: <% tp.frontmatter.image_url %>
file_type: <% tp.frontmatter.file_type %>
file_size_bytes: <% tp.frontmatter.file_size_bytes %>
season: <% tp.frontmatter.season %>
episode_number: <% tp.frontmatter.episode_number %>
tags:
  - podcast
---

# <% tp.frontmatter.episode_title %>

> [!info] Episode Details
> **Podcast**: <% tp.frontmatter.podcast_title %>
> **Author**: <% tp.frontmatter.author %>
> **Published**: <% tp.frontmatter.published_date %>
> **Duration**: <% tp.frontmatter.duration_formatted %>
> **Progress**: <% tp.frontmatter.played_up_to_formatted %> / <% tp.frontmatter.duration_formatted %> (<% tp.frontmatter.progress_percent %>%)
> **Status**: <% tp.frontmatter.completed ? "✅ Completed" : "⏳ In Progress" %>
> **Audio**: [Listen](<% tp.frontmatter.audio_url %>)
> **Episode page**: <% tp.frontmatter.episode_url %>

## Summary

<!-- Add a brief summary of the episode -->

## Key Takeaways

-

## Notes

<!-- Detailed notes, timestamps, quotes -->

## Action Items

- [ ]

## References

<!-- Links, books, people, or resources mentioned -->
