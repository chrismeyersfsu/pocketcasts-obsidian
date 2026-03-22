import {
	Episode,
	MIN_LISTEN_SECONDS,
	formatDate,
	formatDuration,
	isConsidered,
	mapRawEpisode,
	podcastImageUrl,
	progressPct,
} from "../utils";

// Helper to build a minimal Episode for tests
function makeEpisode(overrides: Partial<Episode> = {}): Episode {
	return {
		uuid: "test-uuid",
		title: "Test Episode",
		podcastTitle: "Test Podcast",
		podcastUuid: "podcast-uuid",
		podcastSlug: "test-podcast",
		slug: "test-episode",
		author: "Test Author",
		duration: 3600,
		playedUpTo: 0,
		playingStatus: 0,
		published: "2024-01-15T00:00:00Z",
		url: "https://example.com/episode.mp3",
		fileType: "audio/mpeg",
		fileSize: 1024,
		episodeSeason: 0,
		episodeNumber: 0,
		episodeType: "full",
		starred: false,
		...overrides,
	};
}

// ── isConsidered ─────────────────────────────────────────────────────────────

describe("isConsidered", () => {
	test("returns true when playingStatus is 3 (completed)", () => {
		const ep = makeEpisode({ playingStatus: 3, playedUpTo: 0 });
		expect(isConsidered(ep)).toBe(true);
	});

	test("returns true when playedUpTo meets the minimum listen threshold", () => {
		const ep = makeEpisode({ playingStatus: 0, playedUpTo: MIN_LISTEN_SECONDS });
		expect(isConsidered(ep)).toBe(true);
	});

	test("returns true when playedUpTo exceeds the minimum listen threshold", () => {
		const ep = makeEpisode({ playingStatus: 0, playedUpTo: MIN_LISTEN_SECONDS + 1 });
		expect(isConsidered(ep)).toBe(true);
	});

	test("returns false when playedUpTo is below the minimum threshold and not completed", () => {
		const ep = makeEpisode({ playingStatus: 0, playedUpTo: MIN_LISTEN_SECONDS - 1 });
		expect(isConsidered(ep)).toBe(false);
	});

	test("returns false when episode has not been started", () => {
		const ep = makeEpisode({ playingStatus: 0, playedUpTo: 0 });
		expect(isConsidered(ep)).toBe(false);
	});
});

// ── formatDuration ───────────────────────────────────────────────────────────

describe("formatDuration", () => {
	test("returns '0m' for 0 seconds", () => {
		expect(formatDuration(0)).toBe("0m");
	});

	test("formats seconds-only as minutes", () => {
		expect(formatDuration(90)).toBe("1m");
	});

	test("formats exactly one hour", () => {
		expect(formatDuration(3600)).toBe("1h 0m");
	});

	test("formats hours and minutes", () => {
		expect(formatDuration(5400)).toBe("1h 30m");
	});

	test("formats minutes without hours", () => {
		expect(formatDuration(1800)).toBe("30m");
	});

	test("formats multiple hours", () => {
		expect(formatDuration(7320)).toBe("2h 2m");
	});
});

// ── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
	test("returns empty string for empty input", () => {
		expect(formatDate("")).toBe("");
	});

	test("returns a non-empty string for a valid ISO date string", () => {
		const result = formatDate("2024-01-15T00:00:00Z");
		expect(result).toBeTruthy();
		expect(typeof result).toBe("string");
	});
});

// ── progressPct ──────────────────────────────────────────────────────────────

describe("progressPct", () => {
	test("returns 100 when completed and no duration", () => {
		const ep = makeEpisode({ duration: 0, playingStatus: 3 });
		expect(progressPct(ep)).toBe(100);
	});

	test("returns 0 when not completed and no duration", () => {
		const ep = makeEpisode({ duration: 0, playingStatus: 0 });
		expect(progressPct(ep)).toBe(0);
	});

	test("returns 50 when halfway through", () => {
		const ep = makeEpisode({ duration: 3600, playedUpTo: 1800, playingStatus: 0 });
		expect(progressPct(ep)).toBe(50);
	});

	test("returns 100 when fully played", () => {
		const ep = makeEpisode({ duration: 3600, playedUpTo: 3600, playingStatus: 3 });
		expect(progressPct(ep)).toBe(100);
	});

	test("caps at 100 even if playedUpTo exceeds duration", () => {
		const ep = makeEpisode({ duration: 3600, playedUpTo: 4000, playingStatus: 3 });
		expect(progressPct(ep)).toBe(100);
	});

	test("rounds to nearest integer", () => {
		const ep = makeEpisode({ duration: 3, playedUpTo: 1, playingStatus: 0 });
		expect(progressPct(ep)).toBe(33);
	});
});

// ── mapRawEpisode ─────────────────────────────────────────────────────────────

describe("mapRawEpisode", () => {
	test("maps a fully populated raw episode correctly", () => {
		const raw = {
			uuid: "abc-123",
			title: "My Episode",
			podcastTitle: "My Podcast",
			podcastUuid: "pod-uuid",
			podcastSlug: "my-podcast",
			slug: "my-episode",
			author: "Author Name",
			duration: 3600,
			playedUpTo: 1800,
			playingStatus: 0,
			published: "2024-01-15T00:00:00Z",
			url: "https://example.com/ep.mp3",
			fileType: "audio/mpeg",
			size: 10240,
			episodeSeason: 2,
			episodeNumber: 5,
			episodeType: "full",
			starred: true,
		};
		const ep = mapRawEpisode(raw);
		expect(ep.uuid).toBe("abc-123");
		expect(ep.title).toBe("My Episode");
		expect(ep.podcastTitle).toBe("My Podcast");
		expect(ep.fileSize).toBe(10240);
		expect(ep.starred).toBe(true);
		expect(ep.episodeSeason).toBe(2);
	});

	test("fills in defaults for missing fields", () => {
		const ep = mapRawEpisode({});
		expect(ep.uuid).toBe("");
		expect(ep.title).toBe("Untitled");
		expect(ep.podcastTitle).toBe("Unknown Podcast");
		expect(ep.duration).toBe(0);
		expect(ep.playedUpTo).toBe(0);
		expect(ep.playingStatus).toBe(0);
		expect(ep.fileSize).toBe(0);
		expect(ep.starred).toBe(false);
	});

	test("converts size field to fileSize as a number", () => {
		const ep = mapRawEpisode({ size: 99999 });
		expect(ep.fileSize).toBe(99999);
	});

	test("treats missing size as 0 for fileSize", () => {
		const ep = mapRawEpisode({ title: "No size" });
		expect(ep.fileSize).toBe(0);
	});
});

// ── podcastImageUrl ───────────────────────────────────────────────────────────

describe("podcastImageUrl", () => {
	test("generates URL with default size 480", () => {
		expect(podcastImageUrl("abc-123")).toBe(
			"https://static.pocketcasts.com/discover/images/webp/480/abc-123.webp"
		);
	});

	test("generates URL with custom size", () => {
		expect(podcastImageUrl("abc-123", 200)).toBe(
			"https://static.pocketcasts.com/discover/images/webp/200/abc-123.webp"
		);
	});
});
