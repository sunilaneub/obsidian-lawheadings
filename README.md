# Law Headings

An Obsidian plugin that automatically numbers headings using a configurable legal numbering scheme. Designed for lawyers, law students, and anyone working with structured legal documents.

## Features

- **Automatic numbering** as you type -- headings are numbered in real time
- **Configurable scheme** -- choose the number style and suffix format for each heading level
- **Two commands** for bulk operations: re-number all headings or strip all numbering

## Default Numbering Scheme

| Level | Style | Example |
|-------|-------|---------|
| H1 | Upper alpha | A. B. C. |
| H2 | Roman numerals | I. II. III. |
| H3 | Arabic numerals | 1. 2. 3. |
| H4 | Lower alpha | a) b) c) |
| H5 | Double lower alpha | aa) bb) cc) |
| H6 | Arabic in parens | (1) (2) (3) |

Each level can be individually configured in the plugin settings.

## Usage

1. Enable the plugin in **Settings > Community plugins**.
2. Start writing headings -- they will be numbered automatically.
3. Open the plugin settings to customize the numbering style for each heading level.

### Commands

Open the command palette (`Ctrl/Cmd + P`) and search for:

- **Update heading numbers** -- re-number all headings in the current note
- **Remove heading numbers** -- strip all numbering prefixes from headings

## Installation

Search for **Law Headings** in **Settings > Community plugins > Browse** and click Install.

### Manual Installation

Download `main.js` and `manifest.json` from the [latest release](https://github.com/sunilaneub/obsidian-lawheadings/releases/latest) and place them in your vault at `.obsidian/plugins/lawheadings/`. Then enable the plugin in Obsidian settings.
