# gaggibot ☕🤖

**The proactive companion for your [GaggiMate](https://gaggimate.eu).**

Ever found yourself sprinting back to the kitchen — or worse, switching the
machine back ON — just to stare at that pressure curve one more time? Ever lain
in bed at 23:47, wide awake, haunted by the realization that you never logged
the grind setting of today's *god shot*, and now it's gone, lost forever like
crema in the sink?

gaggibot has you covered. It flips the workflow: instead of you opening the web
UI after every shot, **your espresso machine slides into your DMs.**

> ☕ **Shot #59 done!** Direct Lever v3 · 28s · 36.2 g in the cup
> Let's log it before you forget:
> **How was it?** ★ ★★ ★★★ ★★★★ ★★★★★

Thirty seconds of tapping while you sip, and your rating, beans, grind setting,
doses and tasting notes are filed **into the machine's own Shot Notes** —
exactly as if you'd typed them into the GaggiMate web UI, minus the part where
you open the GaggiMate web UI. Optionally, every shot is also archived to a git
repo and published as a browsable **shot journal** with pressure/flow/temp
charts (GitHub Pages, no cloud, no trackers).

gaggibot is *not* a replacement for the web UI — it's a different philosophy.
The web UI waits for you. gaggibot doesn't.

## Features

- **Post-shot questionnaire** via **Telegram** or **Discord** (Matrix planned):
  rating, balance/taste, bean, grind, dose in/out — with "same as last shot"
  one-tap defaults, because you probably didn't change beans since breakfast.
- **Writes back to the machine** over its own WebSocket API
  (`req:history:notes:save`) — your notes show up in the GaggiMate web UI and
  survive without gaggibot.
- **Shot journal site generator**: decodes GaggiMate's binary `.slog` shot logs
  and renders a static, self-contained explorer (shot list, ratings, per-shot
  pressure/flow/temperature/weight charts with phase markers). Perfect for
  GitHub Pages.
- **Git sync**: after each shot, the `.slog` + notes + brew profiles + settings
  (credentials redacted) are committed and pushed to your data repo.
- **`.slog` decoder CLI** — also useful standalone:
  `gaggibot decode 000058.slog --csv`
- Utility shots (backflush, descale, flush) are ignored automatically, as are
  shots shorter than 10 s. Your cleaning routine does not deserve a star rating.

## Install

### Docker (recommended)

```bash
mkdir gaggibot && cd gaggibot
curl -O https://raw.githubusercontent.com/AlexNly/gaggibot/main/docker-compose.example.yml
cp docker-compose.example.yml docker-compose.yml
# edit docker-compose.yml: machine host + bot token + chat id
docker compose up -d
```

Images are multi-arch (`amd64` + `arm64` — Raspberry Pi works fine):
`ghcr.io/alexnly/gaggibot:latest`.

### pip

```bash
pip install "gaggibot[telegram] @ git+https://github.com/AlexNly/gaggibot"
gaggibot run
```

### NixOS (flake)

```nix
# flake input
inputs.gaggibot.url = "github:AlexNly/gaggibot";

# module
services.gaggibot = {
  enable = true;
  machineHost = "192.168.1.50";
  environmentFile = "/etc/secrets/gaggibot";  # TELEGRAM_BOT_TOKEN=... / TELEGRAM_CHAT_ID=...
  dataRepo = "/var/lib/gaggimate-journal";    # optional
};
```

## Setup

1. **Telegram**: talk to [@BotFather](https://t.me/BotFather) → `/newbot` → copy
   the token. Message your new bot once, then get your chat id from
   `https://api.telegram.org/bot<TOKEN>/getUpdates`.
   **Discord**: create an application + bot at the developer portal, invite it
   to a server, enable the *message content* intent, copy the channel id.
2. Point `GAGGIBOT_MACHINE_HOST` at your GaggiMate (a static IP/DHCP
   reservation is more reliable than `gaggimate.local`).
3. Pull a shot. Answer the questions. That's it.

## Configuration

Environment variables (or the same keys in `~/.config/gaggibot/config.toml`):

| Variable | Default | Meaning |
|---|---|---|
| `GAGGIBOT_MACHINE_HOST` | `gaggimate.local` | GaggiMate hostname/IP |
| `GAGGIBOT_MESSENGER` | `telegram` | `telegram` or `discord` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | — | Telegram credentials |
| `DISCORD_BOT_TOKEN` / `DISCORD_CHANNEL_ID` | — | Discord credentials |
| `GAGGIBOT_DATA_REPO` | — | Path to a git clone; enables sync + sitegen |
| `GAGGIBOT_STATE_DIR` | `~/.local/state/gaggibot` | Bot state (defaults, resume) |
| `GAGGIBOT_MIN_SHOT_S` | `10` | Ignore shots shorter than this |
| `GAGGIBOT_IGNORE_PROFILES` | `(?i)backflush\|descale\|flush\|clean` | Profile regex to skip |

## CLI

```
gaggibot run                 # the bot (add --replay frames.jsonl --dry-run to test)
gaggibot decode SHOT.slog    # .slog -> JSON (--csv for CSV)
gaggibot sitegen shots/ -o docs/ --title "My Shot Journal"
gaggibot sync                # one-off journal sync (shots, profiles, settings, site)
```

## Publishing your shot journal (GitHub Pages)

1. Create a repo for your data, clone it where gaggibot runs, set
   `GAGGIBOT_DATA_REPO` to the clone.
2. On GitHub: *Settings → Pages → Deploy from branch → `main` / `/docs`*.
3. Every shot now updates `https://<you>.github.io/<repo>/` — charts, ratings,
   notes. Send the link to the friend who claims your espresso "all tastes the
   same". Demolish them with data.

## How it talks to your machine

Local network only — nothing leaves your LAN except the messenger API and your
own git remote. GaggiMate side (firmware ≥ v1.7 with binary shot logs):

- `ws://<machine>/ws` — `evt:status` frames for live shot detection,
  `req:history:notes:save` for writing notes, `req:profiles:list` for backup
- `GET /api/history/index.bin`, `<id>.slog`, `<id>.json` — shot downloads
- `GET /api/settings` — settings backup (WiFi/HA/AP credentials are redacted
  before anything is written to disk)

The `.slog` v5 binary format (512-byte header, magic `SHOT`, 26-byte samples at
250 ms: temps, pressures, flows, weights, puck resistance, phase transitions)
is documented in [`src/gaggibot/slog.py`](src/gaggibot/slog.py).

### WhatsApp?

There's no sane self-hosted WhatsApp bot API. Two workable paths: bridge your
gaggibot Telegram/Matrix chat via [mautrix bridges](https://docs.mau.fi/bridges/),
or Meta's WhatsApp Business Cloud API (requires a Meta business account).
Native support: contributions welcome.

## License

MIT. Not affiliated with the GaggiMate project — just a very caffeinated fan.
