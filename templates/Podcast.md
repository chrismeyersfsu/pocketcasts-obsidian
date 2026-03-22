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
