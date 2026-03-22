import {
	App,
	ItemView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
	requestUrl,
} from "obsidian";

const VIEW_TYPE_POCKETCASTS = "pocketsync-history";
const API_BASE = "https://api.pocketcasts.com";
const MIN_LISTEN_SECONDS = 5 * 60; // 5 minutes

interface PocketCastsSettings {
	email: string;
	password: string;
	token: string;
}

const DEFAULT_SETTINGS: PocketCastsSettings = {
	email: "",
	password: "",
	token: "",
};

interface Episode {
	uuid: string;
	title: string;
	podcastTitle: string;
	author: string;
	duration: number;       // total seconds
	playedUpTo: number;     // seconds listened
	playingStatus: number;  // 3 = completed
	publishedAt: string;
	podcastUuid: string;
}

function isConsidered(ep: Episode): boolean {
	return ep.playingStatus === 3 || ep.playedUpTo >= MIN_LISTEN_SECONDS;
}

function formatDuration(seconds: number): string {
	if (!seconds) return "0m";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

function formatDate(dateStr: string): string {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function progressPct(ep: Episode): number {
	if (!ep.duration) return ep.playingStatus === 3 ? 100 : 0;
	return Math.min(100, Math.round((ep.playedUpTo / ep.duration) * 100));
}

// ── API ──────────────────────────────────────────────────────────────────────

async function apiLogin(email: string, password: string): Promise<string> {
	const resp = await requestUrl({
		url: `${API_BASE}/user/login`,
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password, scope: "webplayer" }),
	});
	if (resp.status !== 200) throw new Error(`Login failed (${resp.status})`);
	return resp.json.token as string;
}

async function apiFetchHistory(token: string): Promise<Episode[]> {
	const resp = await requestUrl({
		url: `${API_BASE}/user/history`,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({}),
	});
	if (resp.status !== 200) throw new Error(`History fetch failed (${resp.status})`);
	const episodes: Episode[] = (resp.json.episodes ?? []).map((e: any) => ({
		uuid: e.uuid,
		title: e.title ?? "Untitled",
		podcastTitle: e.podcastTitle ?? e.podcast ?? "Unknown Podcast",
		author: e.author ?? "",
		duration: e.duration ?? 0,
		playedUpTo: e.playedUpTo ?? 0,
		playingStatus: e.playingStatus ?? 0,
		publishedAt: e.publishedAt ?? "",
		podcastUuid: e.podcastUuid ?? "",
	}));
	return episodes;
}

// ── View ─────────────────────────────────────────────────────────────────────

class PocketCastsView extends ItemView {
	plugin: PocketCastsPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: PocketCastsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_POCKETCASTS;
	}

	getDisplayText(): string {
		return "Pocket Casts History";
	}

	getIcon(): string {
		return "headphones";
	}

	async onOpen() {
		this.render([]);
		await this.refresh();
	}

	async refresh() {
		const { email, password } = this.plugin.settings;
		if (!email || !password) {
			this.renderError("Configure your Pocket Casts credentials in Settings.");
			return;
		}

		this.renderLoading();
		try {
			if (!this.plugin.settings.token) {
				this.plugin.settings.token = await apiLogin(email, password);
				await this.plugin.saveSettings();
			}

			let episodes: Episode[];
			try {
				episodes = await apiFetchHistory(this.plugin.settings.token);
			} catch {
				// Token may have expired — re-login once
				this.plugin.settings.token = await apiLogin(email, password);
				await this.plugin.saveSettings();
				episodes = await apiFetchHistory(this.plugin.settings.token);
			}

			const considered = episodes.filter(isConsidered);
			this.render(considered);
		} catch (err) {
			this.renderError(`Error: ${err.message}`);
		}
	}

	private renderLoading() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("p", { text: "Loading listening history…", cls: "pocketcasts-loading" });
	}

	private renderError(msg: string) {
		const { contentEl } = this;
		contentEl.empty();
		const wrap = contentEl.createDiv({ cls: "pocketcasts-error" });
		wrap.createEl("span", { text: "⚠ " });
		wrap.createEl("span", { text: msg });
	}

	private render(episodes: Episode[]) {
		const { contentEl } = this;
		contentEl.empty();

		// Header
		const header = contentEl.createDiv({ cls: "pocketcasts-header" });
		header.createEl("h2", { text: "Pocket Casts" });

		const controls = header.createDiv({ cls: "pocketcasts-controls" });
		const refreshBtn = controls.createEl("button", { text: "Refresh" });
		refreshBtn.addEventListener("click", () => this.refresh());

		if (episodes.length === 0) {
			contentEl.createEl("p", { text: "No episodes found.", cls: "pocketcasts-empty" });
			return;
		}

		// Stats bar
		const stats = contentEl.createDiv({ cls: "pocketcasts-stats" });
		const totalListened = episodes.reduce((s, e) => s + (e.playedUpTo || 0), 0);
		const completed = episodes.filter(e => e.playingStatus === 3).length;
		stats.createEl("span", { text: `${episodes.length} episodes` });
		stats.createEl("span", { text: " · " });
		stats.createEl("span", { text: `${completed} completed` });
		stats.createEl("span", { text: " · " });
		stats.createEl("span", { text: `${formatDuration(totalListened)} total` });

		// Episode list
		const list = contentEl.createDiv({ cls: "pocketcasts-list" });
		for (const ep of episodes) {
			this.renderEpisode(list, ep);
		}
	}

	private renderEpisode(container: HTMLElement, ep: Episode) {
		const card = container.createDiv({ cls: "pocketcasts-card" });

		const topRow = card.createDiv({ cls: "pocketcasts-card-top" });

		const info = topRow.createDiv({ cls: "pocketcasts-card-info" });
		info.createEl("div", { text: ep.title, cls: "pocketcasts-episode-title" });
		info.createEl("div", { text: ep.podcastTitle, cls: "pocketcasts-podcast-title" });

		const meta = topRow.createDiv({ cls: "pocketcasts-card-meta" });
		const pct = progressPct(ep);
		const badge = pct >= 100 ? "100%" : `${pct}%`;
		meta.createEl("span", {
			text: badge,
			cls: pct >= 100 ? "pocketcasts-badge pocketcasts-badge-done" : "pocketcasts-badge",
		});

		const bottomRow = card.createDiv({ cls: "pocketcasts-card-bottom" });
		if (ep.publishedAt) {
			bottomRow.createEl("span", { text: formatDate(ep.publishedAt), cls: "pocketcasts-date" });
		}
		bottomRow.createEl("span", {
			text: `${formatDuration(ep.playedUpTo)} / ${formatDuration(ep.duration)}`,
			cls: "pocketcasts-duration",
		});

		// Progress bar
		const barWrap = card.createDiv({ cls: "pocketcasts-progress-wrap" });
		const bar = barWrap.createDiv({ cls: "pocketcasts-progress-bar" });
		bar.style.width = `${pct}%`;
	}
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

class PocketCastsSettingTab extends PluginSettingTab {
	plugin: PocketCastsPlugin;

	constructor(app: App, plugin: PocketCastsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Pocket Casts Sync" });

		new Setting(containerEl)
			.setName("Email")
			.setDesc("Your Pocket Casts account email")
			.addText(text =>
				text
					.setPlaceholder("email@example.com")
					.setValue(this.plugin.settings.email)
					.onChange(async value => {
						this.plugin.settings.email = value.trim();
						this.plugin.settings.token = "";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Password")
			.setDesc("Your Pocket Casts account password")
			.addText(text => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("••••••••")
					.setValue(this.plugin.settings.password)
					.onChange(async value => {
						this.plugin.settings.password = value;
						this.plugin.settings.token = "";
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Open listening history")
			.addButton(btn =>
				btn
					.setButtonText("Open view")
					.setCta()
					.onClick(() => this.plugin.activateView())
			);
	}
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default class PocketCastsPlugin extends Plugin {
	settings: PocketCastsSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_POCKETCASTS, leaf => new PocketCastsView(leaf, this));

		this.addRibbonIcon("headphones", "Pocket Casts History", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-pocketcasts-history",
			name: "Open listening history",
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "refresh-pocketcasts-history",
			name: "Refresh listening history",
			callback: async () => {
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_POCKETCASTS)[0];
				if (leaf) {
					(leaf.view as PocketCastsView).refresh();
				} else {
					await this.activateView();
				}
			},
		});

		this.addSettingTab(new PocketCastsSettingTab(this.app, this));

		this.addStyles();
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_POCKETCASTS);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_POCKETCASTS);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_POCKETCASTS, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	private addStyles() {
		const style = document.createElement("style");
		style.id = "pocketcasts-styles";
		style.textContent = `
.pocketcasts-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px 8px;
	border-bottom: 1px solid var(--background-modifier-border);
}
.pocketcasts-header h2 {
	margin: 0;
	font-size: 1.1em;
}
.pocketcasts-controls button {
	font-size: 0.8em;
	padding: 3px 10px;
}
.pocketcasts-stats {
	padding: 6px 16px;
	font-size: 0.8em;
	color: var(--text-muted);
	border-bottom: 1px solid var(--background-modifier-border);
}
.pocketcasts-loading,
.pocketcasts-empty {
	padding: 24px 16px;
	color: var(--text-muted);
	font-size: 0.9em;
}
.pocketcasts-error {
	padding: 16px;
	color: var(--text-error);
	font-size: 0.9em;
}
.pocketcasts-list {
	overflow-y: auto;
}
.pocketcasts-card {
	padding: 10px 16px 8px;
	border-bottom: 1px solid var(--background-modifier-border);
}
.pocketcasts-card:hover {
	background: var(--background-secondary-alt);
}
.pocketcasts-card-top {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 8px;
}
.pocketcasts-card-info {
	flex: 1;
	min-width: 0;
}
.pocketcasts-episode-title {
	font-size: 0.9em;
	font-weight: 600;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	color: var(--text-normal);
}
.pocketcasts-podcast-title {
	font-size: 0.78em;
	color: var(--text-muted);
	margin-top: 1px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.pocketcasts-card-meta {
	flex-shrink: 0;
}
.pocketcasts-badge {
	font-size: 0.75em;
	padding: 2px 6px;
	border-radius: 4px;
	background: var(--background-modifier-border);
	color: var(--text-muted);
}
.pocketcasts-badge-done {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
}
.pocketcasts-card-bottom {
	display: flex;
	justify-content: space-between;
	margin-top: 4px;
	font-size: 0.74em;
	color: var(--text-faint);
}
.pocketcasts-progress-wrap {
	margin-top: 5px;
	height: 3px;
	background: var(--background-modifier-border);
	border-radius: 2px;
	overflow: hidden;
}
.pocketcasts-progress-bar {
	height: 100%;
	background: var(--interactive-accent);
	border-radius: 2px;
	transition: width 0.3s ease;
}
`;
		document.head.appendChild(style);
	}
}
