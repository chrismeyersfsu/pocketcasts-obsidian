export const MIN_LISTEN_SECONDS = 5 * 60; // 5 minutes

export interface RawEpisode {
	uuid?: string;
	title?: string;
	podcastTitle?: string;
	podcastUuid?: string;
	podcastSlug?: string;
	slug?: string;
	author?: string;
	duration?: number;
	playedUpTo?: number;
	playingStatus?: number;
	published?: string;
	url?: string;
	fileType?: string;
	size?: number;
	episodeSeason?: number;
	episodeNumber?: number;
	episodeType?: string;
	starred?: boolean;
}

export function mapRawEpisode(e: RawEpisode): Episode {
	return {
		uuid: e.uuid ?? "",
		title: e.title ?? "Untitled",
		podcastTitle: e.podcastTitle ?? "Unknown Podcast",
		podcastUuid: e.podcastUuid ?? "",
		podcastSlug: e.podcastSlug ?? "",
		slug: e.slug ?? "",
		author: e.author ?? "",
		duration: e.duration ?? 0,
		playedUpTo: e.playedUpTo ?? 0,
		playingStatus: e.playingStatus ?? 0,
		published: e.published ?? "",
		url: e.url ?? "",
		fileType: e.fileType ?? "",
		fileSize: Number(e.size ?? 0),
		episodeSeason: e.episodeSeason ?? 0,
		episodeNumber: e.episodeNumber ?? 0,
		episodeType: e.episodeType ?? "",
		starred: e.starred ?? false,
	};
}

export interface Episode {
	uuid: string;
	title: string;
	podcastTitle: string;
	podcastUuid: string;
	podcastSlug: string;
	slug: string;
	author: string;
	duration: number;       // total seconds
	playedUpTo: number;     // seconds listened
	playingStatus: number;  // 3 = completed
	published: string;
	url: string;            // audio file URL
	fileType: string;
	fileSize: number;       // bytes (field: size)
	episodeSeason: number;
	episodeNumber: number;
	episodeType: string;    // "full" | "trailer" | "bonus"
	starred: boolean;
}

export function isConsidered(ep: Episode): boolean {
	return ep.playingStatus === 3 || ep.playedUpTo >= MIN_LISTEN_SECONDS;
}

export function formatDuration(seconds: number): string {
	if (!seconds) return "0m";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

export function formatDate(dateStr: string): string {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function progressPct(ep: Episode): number {
	if (!ep.duration) return ep.playingStatus === 3 ? 100 : 0;
	return Math.min(100, Math.round((ep.playedUpTo / ep.duration) * 100));
}

export function podcastImageUrl(podcastUuid: string, size = 480): string {
	return `https://static.pocketcasts.com/discover/images/webp/${size}/${podcastUuid}.webp`;
}
