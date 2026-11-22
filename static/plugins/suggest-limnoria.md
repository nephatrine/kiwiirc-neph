# Limnoria Suggestions

## Overview

Adds `/lim`, local Limnoria command suggestions, syntax hints, and per-network
bot settings. `/lim` sends the command to the configured Limnoria bot as a
private or channel message, depending on the command.

The default configuration enables this plugin.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "suggest-limnoria", "url": "static/plugins/suggest-limnoria.html" }
]
```

Remove it from the `plugins` array to disable the feature. Without the plugin,
`/lim` is not available and no Limnoria command suggestions are loaded.

## Settings

Administrators can set defaults under `limnoria` in configuration. Users
override them per network in **App Settings → Active Network**.

- `limnoria.suggestions` — Enables `/lim` and local suggestions. Default:
  `false`.
- `limnoria.name` — Limnoria bot nick. Default: `SupyBot`.
- `limnoria.plugins` — Comma- or space-separated filters for local suggestions.
  Default: `Admin, Channel, Config, Misc, Owner, User`.

`limnoria.plugins` only filters suggestions and help; execution still accepts
the full command table.

## Commands

- `/lim <command>` sends the command to the Limnoria bot.
- Channel-delivered commands require the current buffer to be a channel where
  the bot is present and use `<bot>: <command>`.
- Private-delivered commands, and commands in a PM with the bot, use
  `/msg <bot> <command>`.
- Unknown commands are sent privately to the bot.

## Suggestions

Suggestions are local and token-by-token: plugin, command, then subcommand.
Ambiguous shortcuts are suppressed. The syntax hint appears for `/lim ...`,
`/msg <bot> ...`, `<bot>: ...`, and PMs with the bot.
