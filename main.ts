import { App, Plugin, PluginSettingTab, Setting, Editor } from "obsidian";
import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";

/**
 * Law Headings – Obsidian Plugin
 *
 * Automatische Nummerierung von Headings mit konfigurierbarem Schema.
 */

// ── Types ──────────────────────────────────────────────────────────

type NumberStyle = "upperAlpha" | "lowerAlpha" | "doubleLowerAlpha" | "roman" | "arabic" | "none";
type SuffixStyle = "dot" | "paren" | "parens";

interface LevelFormat {
	numberStyle: NumberStyle;
	suffixStyle: SuffixStyle;
}

interface LawHeadingsSettings {
	levels: LevelFormat[];
}

const DEFAULT_SETTINGS: LawHeadingsSettings = {
	levels: [
		{ numberStyle: "upperAlpha", suffixStyle: "dot" },      // H1: A. B. C.
		{ numberStyle: "roman", suffixStyle: "dot" },            // H2: I. II. III.
		{ numberStyle: "arabic", suffixStyle: "dot" },           // H3: 1. 2. 3.
		{ numberStyle: "lowerAlpha", suffixStyle: "paren" },     // H4: a) b) c)
		{ numberStyle: "doubleLowerAlpha", suffixStyle: "paren" }, // H5: aa) bb) cc)
		{ numberStyle: "arabic", suffixStyle: "parens" },        // H6: (1) (2) (3)
	],
};

const NUMBER_STYLE_LABELS: Record<NumberStyle, string> = {
	upperAlpha: "Grossbuchstaben (A, B, C)",
	lowerAlpha: "Kleinbuchstaben (a, b, c)",
	doubleLowerAlpha: "Doppelte Kleinbuchstaben (aa, bb, cc)",
	roman: "Roemische Ziffern (I, II, III)",
	arabic: "Arabische Ziffern (1, 2, 3)",
	none: "Keine Nummerierung",
};

const SUFFIX_STYLE_LABELS: Record<SuffixStyle, string> = {
	dot: "Punkt: X.",
	paren: "Klammer: X)",
	parens: "In Klammern: (X)",
};

// ── Numbering helpers ──────────────────────────────────────────────

function toUpperAlpha(n: number): string {
	let result = "";
	while (n > 0) {
		n--;
		result = String.fromCharCode(65 + (n % 26)) + result;
		n = Math.floor(n / 26);
	}
	return result;
}

function toLowerAlpha(n: number): string {
	let result = "";
	while (n > 0) {
		n--;
		result = String.fromCharCode(97 + (n % 26)) + result;
		n = Math.floor(n / 26);
	}
	return result;
}

function toDoubleLowerAlpha(n: number): string {
	const ch = String.fromCharCode(96 + (((n - 1) % 26) + 1));
	return ch + ch;
}

function toRoman(num: number): string {
	const lookup: [number, string][] = [
		[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
		[100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
		[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
	];
	let roman = "";
	for (const [value, numeral] of lookup) {
		while (num >= value) {
			roman += numeral;
			num -= value;
		}
	}
	return roman;
}

function convertNumber(style: NumberStyle, count: number): string {
	switch (style) {
		case "upperAlpha": return toUpperAlpha(count);
		case "lowerAlpha": return toLowerAlpha(count);
		case "doubleLowerAlpha": return toDoubleLowerAlpha(count);
		case "roman": return toRoman(count);
		case "arabic": return String(count);
		case "none": return "";
	}
}

function applySuffix(num: string, suffix: SuffixStyle): string {
	switch (suffix) {
		case "dot": return num + ".";
		case "paren": return num + ")";
		case "parens": return "(" + num + ")";
	}
}

function formatNumber(level: number, count: number, settings: LawHeadingsSettings): string {
	const fmt = settings.levels[level];
	if (!fmt || fmt.numberStyle === "none") return "";
	const num = convertNumber(fmt.numberStyle, count);
	return applySuffix(num, fmt.suffixStyle);
}

// ── Strip patterns ─────────────────────────────────────────────────

// Matches any known numbering prefix at start of text
const STRIP_PATTERN = /^(?:\([A-Za-z]+\)|\([IVXLCDM]+\)|\(\d+\)|[A-Z]+\.|[IVXLCDM]+\.|[a-z]{2}\)|[a-z]\)|\d+\.)\s*/;

function stripExistingNumber(text: string): string {
	return text.replace(STRIP_PATTERN, "");
}

// ── Core: scan document and compute changes ────────────────────────

interface HeadingChange {
	lineNumber: number;
	from: number;
	to: number;
	newContent: string;
}

function computeHeadingChanges(doc: string, settings: LawHeadingsSettings): HeadingChange[] {
	const lines = doc.split("\n");
	const counters = [0, 0, 0, 0, 0, 0];
	const changes: HeadingChange[] = [];
	let offset = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const match = line.match(/^(#{1,6})\s(.*)$/);

		if (match) {
			const hashes = match[1];
			const level = hashes.length - 1;
			const contentAfterHashes = match[2];
			const rawText = stripExistingNumber(contentAfterHashes);

			if (rawText.trim() !== "") {
				counters[level]++;
				for (let j = level + 1; j < counters.length; j++) {
					counters[j] = 0;
				}

				const prefix = formatNumber(level, counters[level], settings);
				const newContent = prefix ? prefix + " " + rawText : rawText;

				if (newContent !== contentAfterHashes) {
					const contentStart = offset + hashes.length + 1;
					const contentEnd = offset + line.length;
					changes.push({ lineNumber: i, from: contentStart, to: contentEnd, newContent });
				}
			}
		}

		offset += line.length + 1;
	}

	return changes;
}

// ── Plugin ─────────────────────────────────────────────────────────

export default class LawHeadingsPlugin extends Plugin {
	settings: LawHeadingsSettings = DEFAULT_SETTINGS;
	private isUpdating = false;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new LawHeadingsSettingTab(this.app, this));

		const plugin = this;
		const ext = ViewPlugin.fromClass(
			class {
				private timer: ReturnType<typeof setTimeout> | null = null;

				update(update: ViewUpdate) {
					if (!update.docChanged) return;
					if (plugin.isUpdating) return;

					if (this.timer) clearTimeout(this.timer);
					this.timer = setTimeout(() => {
						this.applyNumbering(update.view);
					}, 300);
				}

				applyNumbering(view: EditorView) {
					if (plugin.isUpdating) return;

					const doc = view.state.doc.toString();
					const changes = computeHeadingChanges(doc, plugin.settings);

					if (changes.length === 0) return;

					const sorted = changes.sort((a, b) => b.from - a.from);
					const specs = sorted.map((c) => ({
						from: c.from,
						to: c.to,
						insert: c.newContent,
					}));

					plugin.isUpdating = true;
					view.dispatch({ changes: specs });
					plugin.isUpdating = false;
				}

				destroy() {
					if (this.timer) clearTimeout(this.timer);
				}
			}
		);

		this.registerEditorExtension(ext);

		this.addCommand({
			id: "update-heading-numbers",
			name: "Nummerierung aktualisieren",
			editorCallback: (editor: Editor) => {
				this.updateHeadingsManual(editor);
			},
		});

		this.addCommand({
			id: "remove-heading-numbers",
			name: "Nummerierung entfernen",
			editorCallback: (editor: Editor) => {
				this.removeHeadings(editor);
			},
		});
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		// Ensure all 6 levels exist (in case saved data has fewer)
		if (this.settings.levels.length < 6) {
			for (let i = this.settings.levels.length; i < 6; i++) {
				this.settings.levels[i] = DEFAULT_SETTINGS.levels[i];
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateHeadingsManual(editor: Editor) {
		const doc = editor.getValue();
		const changes = computeHeadingChanges(doc, this.settings);
		if (changes.length === 0) return;

		const lines = doc.split("\n");
		const sorted = changes.sort((a, b) => b.lineNumber - a.lineNumber);

		for (const change of sorted) {
			const line = lines[change.lineNumber];
			const match = line.match(/^(#{1,6})\s/);
			if (!match) continue;
			editor.setLine(change.lineNumber, match[0] + change.newContent);
		}
	}

	removeHeadings(editor: Editor) {
		const doc = editor.getValue();
		const lines = doc.split("\n");

		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i];
			const match = line.match(/^(#{1,6})\s(.*)$/);
			if (!match) continue;

			const stripped = stripExistingNumber(match[2]);
			if (stripped !== match[2]) {
				editor.setLine(i, match[1] + " " + stripped);
			}
		}
	}
}

// ── Settings Tab ───────────────────────────────────────────────────

class LawHeadingsSettingTab extends PluginSettingTab {
	plugin: LawHeadingsPlugin;

	constructor(app: App, plugin: LawHeadingsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Heading-Nummerierung konfigurieren" });
		containerEl.createEl("p", {
			text: "Waehle fuer jedes Heading-Level den Nummernstil und das Suffix-Format.",
			cls: "setting-item-description",
		});

		for (let level = 0; level < 6; level++) {
			const hashes = "#".repeat(level + 1);
			const fmt = this.plugin.settings.levels[level];
			const preview = fmt.numberStyle === "none"
				? "keine"
				: applySuffix(convertNumber(fmt.numberStyle, level + 1), fmt.suffixStyle);

			const heading = containerEl.createEl("h3", {
				text: `${hashes} Heading ${level + 1}`,
			});

			const previewEl = heading.createEl("span", {
				text: ` — Vorschau: ${preview}`,
				cls: "setting-item-description",
			});
			previewEl.style.fontSize = "0.85em";
			previewEl.style.fontWeight = "normal";
			previewEl.style.marginLeft = "8px";

			new Setting(containerEl)
				.setName("Nummernstil")
				.addDropdown((dropdown) => {
					for (const [key, label] of Object.entries(NUMBER_STYLE_LABELS)) {
						dropdown.addOption(key, label);
					}
					dropdown.setValue(fmt.numberStyle);
					dropdown.onChange(async (value) => {
						this.plugin.settings.levels[level].numberStyle = value as NumberStyle;
						await this.plugin.saveSettings();
						this.display(); // refresh preview
					});
				});

			if (fmt.numberStyle !== "none") {
				new Setting(containerEl)
					.setName("Suffix-Format")
					.addDropdown((dropdown) => {
						for (const [key, label] of Object.entries(SUFFIX_STYLE_LABELS)) {
							dropdown.addOption(key, label);
						}
						dropdown.setValue(fmt.suffixStyle);
						dropdown.onChange(async (value) => {
							this.plugin.settings.levels[level].suffixStyle = value as SuffixStyle;
							await this.plugin.saveSettings();
							this.display(); // refresh preview
						});
					});
			}
		}
	}
}
