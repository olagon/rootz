# Rootz

A daily Hawaiian word sorting puzzle. Find four groups of four words.

**Live at [olagon.github.io/rootz](https://olagon.github.io/rootz/)**

## How it works

Each puzzle gives you 16 Hawaiian words on a 4x4 board. Sort them into four hidden groups of four. You get four mistakes. Use Shuffle if the board feels stuck. Use Practice mode any time, or play any of the 30 day puzzles from the archive.

Your daily streak, win rate, and best streak live in your browser. Nothing is sent to a server. There is no sign in, no analytics, no tracking.

## Built for

- Phones first. Touch targets are 44px and the tile font is fluid so the longest Hawaiian words still fit on a 320px wide screen.
- Installable as a Progressive Web App. Add to home screen and it runs offline.
- Light and dark mode. Toggle in the header. Choice is remembered across visits.

## Tech

- Pure HTML, CSS, and JavaScript. No frameworks, no build step.
- One static page, one stylesheet, one script, one JSON file of puzzles.
- Service worker caches the assets for offline play.
- Hosted on GitHub Pages.

## Run it locally

Clone the repo and open `index.html` in any modern browser. That is the whole setup.

```bash
git clone https://github.com/olagon/rootz.git
cd rootz
open index.html
```

If you want to test the service worker and PWA install, serve it with any static server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Adding or fixing puzzles

Puzzles live in `puzzles.json`. Each entry has four groups of four words plus a label and a color tier per group. Open a pull request or send a note on LinkedIn if you spot an error or have a puzzle to contribute.

## Credits

Built with aloha by [Olin Kealoha Lagon](https://www.linkedin.com/in/olinlagon/).

## License

MIT. See [LICENSE](LICENSE).
