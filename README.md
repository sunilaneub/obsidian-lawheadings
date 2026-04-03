# Law Headings

An Obsidian plugin that automatically numbers headings using a legal numbering scheme.

## Default scheme

| Level | Style | Example |
|-------|-------|---------|
| H1 | Upper alpha | A. B. C. |
| H2 | Roman numerals | I. II. III. |
| H3 | Arabic numerals | 1. 2. 3. |
| H4 | Lower alpha | a) b) c) |
| H5 | Double lower alpha | aa) bb) cc) |
| H6 | Arabic in parens | (1) (2) (3) |

Numbering is applied automatically as you type. The number style and suffix format for each heading level can be configured in the plugin settings.

## Commands

- **Update heading numbers** — re-number all headings in the current note
- **Remove heading numbers** — strip all numbering prefixes

## Installation

Copy `main.js`, `manifest.json`, and optionally `styles.css` into your vault's `.obsidian/plugins/lawheadings/` directory, then enable the plugin in Obsidian settings.
