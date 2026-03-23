import {
	App,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
	requestUrl,
} from "obsidian";
import {
	Episode,
	RawEpisode,
	formatDate,
	formatDuration,
	isConsidered,
	mapRawEpisode,
	podcastImageUrl,
	progressPct,
} from "./utils";

const VIEW_TYPE_POCKETCASTS = "pocketsync-history";
const API_BASE = "https://api.pocketcasts.com";

interface PodcastInfo {
	uuid: string;
	title: string;
}

interface PocketCastsSettings {
	email: string;
	password: string;
	token: string;
	notePath: string;
	noteFilename: string;
	templaterFile: string;
	excludedPodcasts: string[];     // podcast UUIDs to hide from the view
	cachedPodcasts: PodcastInfo[];  // known podcasts for settings display
}

const DEFAULT_SETTINGS: PocketCastsSettings = {
	email: "",
	password: "",
	token: "",
	notePath: "personal/podcasts",
	noteFilename: "{{podcast_name}} - {{podcast_episode}}.md",
	templaterFile: "_templater_templates/Podcast",
	excludedPodcasts: [],
	cachedPodcasts: [],
};

// ── API ──────────────────────────────────────────────────────────────────────

interface TemplaterPlugin {
	templater: {
		write_template_to_file(template: TFile, note: TFile): Promise<void>;
	};
}

interface ObsidianAppWithPlugins extends App {
	plugins: {
		plugins: Record<string, TemplaterPlugin | undefined>;
	};
}

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
	const episodes: Episode[] = (resp.json.episodes ?? []).map((e: RawEpisode) => mapRawEpisode(e));
	return episodes;
}

async function apiFetchShowNotes(episodeUuid: string): Promise<string> {
	try {
		const resp = await requestUrl({
			url: `https://cache.pocketcasts.com/episode/show_notes/${episodeUuid}`,
			method: "GET",
		});

		if (resp.status !== 200) return "";
		return resp.json.show_notes ?? "";
	} catch (e) {
		console.error("PocketSync show_notes fetch error", episodeUuid, e);
		return "";
	}
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
		return "Pocket Casts history";
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

			const excluded = new Set(this.plugin.settings.excludedPodcasts);
			const considered = episodes.filter(ep => isConsidered(ep) && !excluded.has(ep.podcastUuid));
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
		refreshBtn.addEventListener("click", () => { void this.refresh(); });

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
		card.title = "Click to create a note for this episode";
		card.addEventListener("click", () => { void this.plugin.createEpisodeNote(ep); });

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
		meta.createEl("span", { text: "📝", cls: "pocketcasts-note-icon", title: "Create note" });

		const bottomRow = card.createDiv({ cls: "pocketcasts-card-bottom" });
		if (ep.published) {
			bottomRow.createEl("span", { text: formatDate(ep.published), cls: "pocketcasts-date" });
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

// ── File Exists Modal ─────────────────────────────────────────────────────────

type FileExistsChoice = "open" | "overwrite" | "cancel";

class FileExistsModal extends Modal {
	private resolve: (choice: FileExistsChoice) => void;
	private filename: string;
	private resolved = false;

	constructor(app: App, filename: string, resolve: (choice: FileExistsChoice) => void) {
		super(app);
		this.filename = filename;
		this.resolve = resolve;
	}

	private pick(choice: FileExistsChoice) {
		if (this.resolved) return;
		this.resolved = true;
		this.resolve(choice);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Note already exists" });
		contentEl.createEl("p", { text: `"${this.filename}" already exists. What would you like to do?` });

		const btnRow = contentEl.createDiv({ cls: "pocketcasts-modal-buttons" });

		const openBtn = btnRow.createEl("button", { text: "Open existing" });
		openBtn.addEventListener("click", () => { this.pick("open"); this.close(); });

		const overwriteBtn = btnRow.createEl("button", { text: "Overwrite" });
		overwriteBtn.addClass("mod-warning");
		overwriteBtn.addEventListener("click", () => { this.pick("overwrite"); this.close(); });

		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => { this.pick("cancel"); this.close(); });
	}

	onClose() {
		this.pick("cancel");
		this.contentEl.empty();
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
		new Setting(containerEl).setName("Pocket Casts sync").setHeading();

		new Setting(containerEl)
			.setName("Email")
			.setDesc("Your Pocket Casts account email.")
			.addText(text =>
				text
					.setPlaceholder("Email@example.com")
					.setValue(this.plugin.settings.email)
					.onChange(async value => {
						this.plugin.settings.email = value.trim();
						this.plugin.settings.token = "";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Password")
			.setDesc("Your Pocket Casts account password.")
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

		new Setting(containerEl).setName("Note creation").setHeading();

		new Setting(containerEl)
			.setName("Note path")
			.setDesc("Folder where podcast episode notes will be created. Use {{podcast_name}} and {{podcast_episode}} as placeholders. Directories will be created automatically.")
			.addText(text =>
				text
					.setPlaceholder("Personal/podcasts")
					.setValue(this.plugin.settings.notePath)
					.onChange(async value => {
						this.plugin.settings.notePath = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Note filename")
			.setDesc("Filename template. Use {{podcast_name}} and {{podcast_episode}} as placeholders.")
			.addText(text =>
				text
					.setPlaceholder("{{podcast_name}} - {{podcast_episode}}.md")
					.setValue(this.plugin.settings.noteFilename)
					.onChange(async value => {
						this.plugin.settings.noteFilename = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Templater template file")
			.setDesc(
				"Path to a Templater template file (without .md). " +
				"All episode metadata is available via tp.frontmatter in the template. " +
				"Leave empty to use the built-in default format."
			)
			.addText(text =>
				text
					.setPlaceholder("_templater_templates/podcast")
					.setValue(this.plugin.settings.templaterFile)
					.onChange(async value => {
						this.plugin.settings.templaterFile = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Open listening history")
			.addButton(btn =>
				btn
					.setButtonText("Open view")
					.setCta()
					.onClick(() => { void this.plugin.activateView(); })
			);

		new Setting(containerEl).setName("Podcast exclusions").setHeading();
		containerEl.createEl("p", {
			text: "Hide specific podcasts from your listening history view. Load your podcast list first, then toggle off any you want to exclude.",
			cls: "setting-item-description",
		});

		const podcastListEl = containerEl.createDiv({ cls: "pocketcasts-exclusion-list" });

		const renderPodcastList = () => {
			podcastListEl.empty();
			const podcasts = [...this.plugin.settings.cachedPodcasts].sort((a, b) =>
				a.title.localeCompare(b.title)
			);
			if (podcasts.length === 0) {
				podcastListEl.createEl("p", {
					text: 'No podcasts loaded yet. Click "load podcasts" above.',
					cls: "pocketcasts-loading",
				});
				return;
			}
			for (const podcast of podcasts) {
				new Setting(podcastListEl)
					.setName(podcast.title)
					.addToggle(toggle =>
						toggle
							.setValue(!this.plugin.settings.excludedPodcasts.includes(podcast.uuid))
							.onChange(async (show) => {
								if (show) {
									this.plugin.settings.excludedPodcasts =
										this.plugin.settings.excludedPodcasts.filter(id => id !== podcast.uuid);
								} else {
									if (!this.plugin.settings.excludedPodcasts.includes(podcast.uuid)) {
										this.plugin.settings.excludedPodcasts.push(podcast.uuid);
									}
								}
								await this.plugin.saveSettings();
							})
					);
			}
		};

		new Setting(containerEl)
			.setName("Load podcasts")
			.setDesc("Fetch your podcast list from your listening history.")
			.addButton(btn =>
				btn
					.setButtonText("Load podcasts")
					.onClick(async () => {
						btn.setButtonText("Loading…");
						btn.setDisabled(true);
						try {
							const { email, password } = this.plugin.settings;
							if (!email || !password) {
								new Notice("Configure your Pocket Casts credentials first.");
								return;
							}
							if (!this.plugin.settings.token) {
								this.plugin.settings.token = await apiLogin(email, password);
								await this.plugin.saveSettings();
							}
							let episodes: Episode[];
							try {
								episodes = await apiFetchHistory(this.plugin.settings.token);
							} catch {
								this.plugin.settings.token = await apiLogin(email, password);
								await this.plugin.saveSettings();
								episodes = await apiFetchHistory(this.plugin.settings.token);
							}
							// Merge newly discovered podcasts into cache
							const known = new Map(
								this.plugin.settings.cachedPodcasts.map(p => [p.uuid, p.title])
							);
							for (const ep of episodes) {
								if (ep.podcastUuid && !known.has(ep.podcastUuid)) {
									known.set(ep.podcastUuid, ep.podcastTitle);
								}
							}
							this.plugin.settings.cachedPodcasts = Array.from(known.entries()).map(
								([uuid, title]) => ({ uuid, title })
							);
							await this.plugin.saveSettings();
							renderPodcastList();
						} catch (err) {
							new Notice(`PocketSync: ${err.message}`);
						} finally {
							btn.setButtonText("Load podcasts");
							btn.setDisabled(false);
						}
					})
			);

		renderPodcastList();
	}
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default class PocketCastsPlugin extends Plugin {
	settings: PocketCastsSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_POCKETCASTS, leaf => new PocketCastsView(leaf, this));

		this.addRibbonIcon("headphones", "Pocket Casts history", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-pocketcasts-history",
			name: "Open listening history",
			callback: () => { void this.activateView(); },
		});

		this.addCommand({
			id: "refresh-pocketcasts-history",
			name: "Refresh listening history",
			callback: async () => {
				const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_POCKETCASTS)[0];
				if (leaf) {
					await (leaf.view as PocketCastsView).refresh();
				} else {
					await this.activateView();
				}
			},
		});

		this.addSettingTab(new PocketCastsSettingTab(this.app, this));
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
			void this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_POCKETCASTS, active: true });
		void this.app.workspace.revealLeaf(leaf);
	}

	async createEpisodeNote(ep: Episode): Promise<void> {
		const sanitize = (s: string) => s.replace(/[\\/:*?"<>|#^[\]]/g, "-").trim();

		const rawFilename = this.settings.noteFilename
			.replace("{{podcast_name}}", sanitize(ep.podcastTitle))
			.replace("{{podcast_episode}}", sanitize(ep.title));
		const filename = rawFilename.endsWith(".md") ? rawFilename : rawFilename + ".md";

		const folderPath = this.settings.notePath
			.replace("{{podcast_name}}", sanitize(ep.podcastTitle))
			.replace("{{podcast_episode}}", sanitize(ep.title))
			.replace(/\/+$/, "");
		const fullPath = folderPath ? `${folderPath}/${filename}` : filename;

		await this.ensureFolder(folderPath);

		const existing = this.app.vault.getAbstractFileByPath(fullPath);
		if (existing instanceof TFile) {
			const choice = await new Promise<FileExistsChoice>(resolve =>
				new FileExistsModal(this.app, filename, resolve).open()
			);
			if (choice === "cancel") return;
			if (choice === "open") {
				await this.app.workspace.openLinkText(fullPath, "", false);
				return;
			}
			// overwrite: trash and recreate below
			await this.app.fileManager.trashFile(existing);
		}

		const showNotes = await apiFetchShowNotes(ep.uuid);
		const frontmatter = this.buildFrontmatter(ep, showNotes);
		const templaterPlugin = (this.app as ObsidianAppWithPlugins).plugins?.plugins?.["templater-obsidian"];
		const templatePath = this.settings.templaterFile
			? (this.settings.templaterFile.endsWith(".md")
				? this.settings.templaterFile
				: this.settings.templaterFile + ".md")
			: null;
		const templateFile = templatePath
			? this.app.vault.getAbstractFileByPath(templatePath)
			: null;

		if (templaterPlugin && templateFile instanceof TFile) {
			const noteFile = await this.app.vault.create(fullPath, frontmatter);
			// Wait for metadata cache to index the frontmatter
			await new Promise(resolve => setTimeout(resolve, 500));
			try {
				await templaterPlugin.templater.write_template_to_file(templateFile, noteFile);
			} catch (e) {
				console.error("PocketSync: Templater error", e);
				new Notice("Templater failed to apply template. Note created with frontmatter only.");
			}
			await this.app.workspace.openLinkText(fullPath, "", false);
		} else {
			const content = frontmatter + this.buildBasicContent(ep, showNotes);
			await this.app.vault.create(fullPath, content);
			await this.app.workspace.openLinkText(fullPath, "", false);
		}

		new Notice(`Created podcast note: ${filename}`);
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		if (!folderPath) return;
		const parts = folderPath.split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				try {
					await this.app.vault.createFolder(current);
				} catch {
					// Folder may have been created concurrently
				}
			}
		}
	}

	private buildFrontmatter(ep: Episode, showNotes: string): string {
		const esc = (s: string) => s.replace(/"/g, '\\"');
		const date = ep.published ? new Date(ep.published).toISOString().split("T")[0] : "";
		const imageUrl = podcastImageUrl(ep.podcastUuid);
		const lines = [
			"---",
			`podcast_title: "${esc(ep.podcastTitle)}"`,
			`episode_title: "${esc(ep.title)}"`,
			`author: "${esc(ep.author)}"`,
			`episode_uuid: "${ep.uuid}"`,
			`podcast_uuid: "${ep.podcastUuid}"`,
			`podcast_slug: "${ep.podcastSlug}"`,
			`episode_slug: "${ep.slug}"`,
			`published_date: ${date || '""'}`,
			`duration_seconds: ${ep.duration}`,
			`duration_formatted: "${formatDuration(ep.duration)}"`,
			`played_up_to_seconds: ${ep.playedUpTo}`,
			`played_up_to_formatted: "${formatDuration(ep.playedUpTo)}"`,
			`progress_percent: ${progressPct(ep)}`,
			`completed: ${ep.playingStatus === 3}`,
			`playing_status: ${ep.playingStatus}`,
			`starred: ${ep.starred}`,
			`audio_url: "${esc(ep.url)}"`,
			`image_url: "${imageUrl}"`,
		];
		if (ep.fileType)        lines.push(`file_type: "${ep.fileType}"`);
		if (ep.fileSize)        lines.push(`file_size_bytes: ${ep.fileSize}`);
		if (ep.episodeType)     lines.push(`episode_type: "${ep.episodeType}"`);
		if (ep.episodeSeason)   lines.push(`season: ${ep.episodeSeason}`);
		if (ep.episodeNumber)   lines.push(`episode_number: ${ep.episodeNumber}`);
		lines.push(showNotes
			? `description: |\n  ${showNotes.trim().replace(/\n/g, "\n  ")}`
			: `description: ""`);
		lines.push(`tags:\n  - podcast`, "---", "");
		return lines.join("\n");
	}

	private buildBasicContent(ep: Episode, showNotes: string): string {
		const date = ep.published ? formatDate(ep.published) : "";
		const status = ep.playingStatus === 3 ? "Completed" : "In Progress";
		const epLabel = [
			ep.episodeSeason ? `S${ep.episodeSeason}` : null,
			ep.episodeNumber ? `E${ep.episodeNumber}` : null,
		].filter(Boolean).join("");
		const imageUrl = podcastImageUrl(ep.podcastUuid);
		const lines: (string | null)[] = [
			`# ${ep.title}`,
			"",
			`![Podcast artwork](${imageUrl})`,
			"",
			`> [!info] Episode Details`,
			`> **Podcast**: ${ep.podcastTitle}`,
			ep.author    ? `> **Author**: ${ep.author}` : null,
			date         ? `> **Published**: ${date}` : null,
			epLabel      ? `> **Episode**: ${epLabel}` : null,
			ep.episodeType ? `> **Type**: ${ep.episodeType}` : null,
			`> **Duration**: ${formatDuration(ep.duration)}`,
			`> **Progress**: ${formatDuration(ep.playedUpTo)} / ${formatDuration(ep.duration)} (${progressPct(ep)}%)`,
			`> **Status**: ${status}`,
			ep.starred   ? `> **Starred**: yes` : null,
			ep.url       ? `> **Audio**: [Listen](${ep.url})` : null,
			"",
		];
		if (showNotes) {
			lines.push("## Description", "", showNotes.trim(), "");
		}
		lines.push("## Notes", "", "");
		return lines.filter((l): l is string => l !== null).join("\n");
	}

}
