# Suggest Limnoria

## Overview

Bundled `/lim` command, command suggestions, syntax hints, and per-network
Limnoria settings. The plugin translates `/lim` into the correct private or
channel `/msg` for the configured Limnoria bot.

All Limnoria command data lives in
[static/plugins/suggest-limnoria/commands.json](suggest-limnoria/commands.json).
The core client does not include Limnoria command names, syntax, or delivery
rules.

The default configuration enables this plugin.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "suggest-limnoria", "url": "static/plugins/suggest-limnoria.html" }
]
```

Remove it from the `plugins` array to disable the feature. Without the plugin,
`/lim` is not a client command and no Limnoria command data is loaded.

## Settings

Defaults are registered by the plugin, so there is no `configTemplates.js`
entry. Administrators can set defaults under `limnoria` in configuration, and
users override them per network in **App Settings → Active Network**.

| Key                    | Default                                     | Notes                                                                                                 |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `limnoria.suggestions` | `false`                                     | Enables `/lim` and local suggestions.                                                                 |
| `limnoria.name`        | `SupyBot`                                   | Limnoria bot nick.                                                                                    |
| `limnoria.plugins`     | `Admin, Channel, Config, Misc, Owner, User` | Comma- or space-separated filters for local suggestions. Execution still uses the full command table. |

## Commands

- `/lim <command>` resolves the Limnoria command path and sends it to the bot.
- Channel-delivered commands require the current buffer to be a channel with the
  bot present and use `<bot>: <command>`.
- Private-delivered commands and commands in a PM with the bot use
  `/msg <bot> <command>`.
- Unknown commands are sent privately to the bot.

## Suggestions

Suggestions are local and token-by-token: plugin, command, then subcommand.
Ambiguous shortcuts are suppressed. The syntax hint appears for `/lim ...`,
`/msg <bot> ...`, `<bot>: ...`, and PMs with the bot.
