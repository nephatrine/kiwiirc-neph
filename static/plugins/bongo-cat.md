# Bongo Companion

## Overview

A floating desk companion that reacts to typing, chat activity, Twitch notices,
and media playback. It starts hidden; use the **Bongo Companion** settings tab
to show it.

The default configuration enables this plugin.

## Enable

The default `plugins` list includes this entry:

```json
"plugins": [
    { "name": "bongo-cat", "url": "static/plugins/bongo-cat.html" }
]
```

Remove it from the `plugins` array to disable the plugin.

## Configuration

### Skins

Administrators choose which skins users may select:

```json
"plugin-bongo-cat": {
    "skins": ["crabstacean"]
}
```

- `skins` defaults to `["crabstacean"]`.
- An explicit empty array disables the plugin.
- IDs use letters, digits, `_`, and `-`; duplicates are ignored.
- Each ID loads `static/plugins/bongo-cat/<skin-id>.json`.
- The dropdown shows configured IDs, not the skin's metadata name.
- A missing or invalid skin hides the companion and shows an error in the
  settings tab. There is no fallback skin.

### Saved State

Companion state and preferences are stored in browser `localStorage` under
`kiwiirc.bongo-cat`, not in Kiwi `user_settings`. This includes care values,
cooldowns, XP, hats, name, sound, volume, size, position, visibility, and the
selected skin.

All tabs on the same origin share that key but keep separate in-memory copies.
With multiple tabs open, the last save can overwrite another tab's changes. Use
one tab when consistent care or progression state matters.

## Using the Companion

### Settings Tab

- **Name** — Display name, up to 20 characters. Default: `Bongo`.
- **Tap Sounds** — Typing and UI sounds. Default: on.
- **Volume** — Sound volume, `0` to `1` in `0.05` steps. Default: `0.5`.
- **Size** — Automatic, Normal, or Larger. Default: Automatic.
- **Position** — Automatic, Bottom Right, or Top Right. Default: Automatic.
- **Release/Store Companion** — Shows or hides the companion. Default: hidden.
- **Skin** — Selects a configured skin ID. Default: first configured skin.
- **Hat** — Equips an unlocked hat or No Hat. Default: No Hat.
- **Roll Hat** — Spends a level roll.
- **Reset** — Resets care, XP, hats, rolls, and cooldowns.

Reset keeps the name, skin, sound, volume, size, position, and visibility.

### Care

- Hunger rises every 12 minutes; tiredness rises every 10 minutes while awake.
- Mood falls every 18 minutes, faster when hunger or tiredness is high.
- Offline decay is capped at 8 hours. Inactivity sleep pauses tiredness growth.
- Snacks have a 10-minute cooldown: food restores more hunger and adds mood;
  drink restores less hunger and reduces tiredness.
- Naps have a 30-minute cooldown and restore tiredness and mood.
- Petting has a 60-second cooldown and restores mood.
- Highlights add mood; Twitch user notices add a smaller amount.
- While hidden, care stops decaying and active XP stops accruing. Hiding and
  showing reset the care clocks.

### Progression

- Maximum level is 20. XP caps at 1,900.
- Daily login grants 10 XP.
- Active use grants 5 XP per 10 minutes of input activity.
- Dancing to media grants 1 XP per 10 minutes.
- Active and media XP share a 60 XP daily cap; login XP is separate.
- Hidden companions, idle periods, and background tabs do not earn active or
  media XP.

### Placement

- **Automatic** size uses Larger while the nicklist is open, otherwise Normal.
- **Automatic** position uses Bottom Right with a right sidebar or full-page
  view, otherwise Top Right.
- Bottom placement opens the stats card upward; top placement opens it downward.
- The position is saved and preserved by Reset.
- Clicking outside the stats card closes it. Short viewports make the card
  scrollable.

## Creator Guide

This section is for artists and users adding skins, snacks, or hats. A skin is a
JSON file at `static/plugins/bongo-cat/<skin-id>.json` plus an asset directory
at `static/plugins/bongo-cat/<skin-id>/`.

### Assets

Provide transparent RGBA PNG sources and reference generated `.webp` files in
the JSON. `npm run optimize:bongo` creates the WebP runtime files with
ImageMagick; `WEBP_QUALITY` controls quality and `--force` rewrites existing
outputs. Commit both formats: the PNGs are the editable source, and the `.webp`
files are what the companion loads.

### Skin JSON

```json
{
  "name": "My Companion",
  "assets": {
    "body": "body.webp",
    "head": "head.webp",
    "hands": {
      "left": {
        "up1": "hand_l_up1.webp",
        "up2": "hand_l_up2.webp",
        "down": "hand_l_down.webp"
      },
      "right": {
        "up1": "hand_r_up1.webp",
        "up2": "hand_r_up2.webp",
        "down": "hand_r_down.webp"
      }
    },
    "eyes": {
      "open": "eyes.webp",
      "blink": "eyes_blink.webp",
      "tired": "eyes_tired.webp",
      "happy": "eyes_happy.webp",
      "worried": "eyes_worried.webp",
      "sleep": "eyes_sleep.webp",
      "grumpy": "eyes_grumpy.webp"
    },
    "mouth": {
      "neutral": "mouth.webp",
      "smile": "mouth_smile.webp",
      "frown": "mouth_frown.webp",
      "yawn": "mouth_yawn.webp",
      "open": "mouth_open.webp"
    },
    "legs": {
      "idle1": "legs_idle1.webp",
      "idle2": "legs_idle2.webp",
      "sleep": "legs_sleep.webp"
    },
    "ears": {
      "neutral": "ears.webp",
      "perked": "ears_perked.webp",
      "tucked": "ears_tucked.webp"
    },
    "tail": {
      "normal": "tail.webp",
      "happy": "tail_happy.webp",
      "tired": "tail_tired.webp",
      "grumpy": "tail_grumpy.webp",
      "tucked": "tail_tucked.webp"
    }
  },
  "features": {
    "tail": false,
    "legs": true,
    "ears": true,
    "earsInFront": false
  },
  "pivots": {
    "head": {
      "x": 80,
      "y": 80
    },
    "tail": {
      "x": 112,
      "y": 99
    },
    "arms": {
      "left": {
        "x": 50,
        "y": 103
      },
      "right": {
        "x": 110,
        "y": 103
      }
    }
  },
  "hatOffset": 0,
  "sounds": {
    "eat": "eat.wav"
  }
}
```

Asset paths are relative to the skin directory; a path starting with `static/`
is site-root relative. `name` is optional metadata; the dropdown uses the skin
ID. Omit the `legs`, `ears`, or `tail` blocks when their feature is disabled.

### Required Assets

- **Body:** `body.webp`
- **Head:** `head.webp`
- **Eyes:** `eyes.webp`, `eyes_blink.webp`, `eyes_tired.webp`,
  `eyes_happy.webp`, `eyes_worried.webp`, `eyes_sleep.webp`, `eyes_grumpy.webp`
- **Mouth:** `mouth.webp`, `mouth_smile.webp`, `mouth_frown.webp`,
  `mouth_yawn.webp`, `mouth_open.webp`
- **Left hand:** `hand_l_up1.webp`, `hand_l_up2.webp`, `hand_l_down.webp`
- **Right hand:** `hand_r_up1.webp`, `hand_r_up2.webp`, `hand_r_down.webp`

Feature assets:

- `legs`: `legs_idle1.webp`, `legs_idle2.webp`, `legs_sleep.webp`
- `ears`: `ears.webp`, `ears_perked.webp`, `ears_tucked.webp`
- `tail`: `tail.webp`, `tail_happy.webp`, `tail_tired.webp`, `tail_grumpy.webp`,
  `tail_tucked.webp`

Feature flags default to `false`. `earsInFront` places the ears after the hat
but before the eyes.

### Draw Order and Pivots

Tail, legs, body, head group, then hands. The head group draws ears behind,
head, hat, ears in front when enabled, eyes, then mouth. Keep each part separate
and do not bake in the ground shadow; the plugin draws it.

Pivots are in viewBox units: head `80,80`, left arm `50,103`, right arm
`110,103`, tail `112,99`. `hatOffset` moves equipped hats down from the top of
the canvas.

### Sounds

Optional `sounds` replace `eat`, `drink`, `laugh`, `snore`, `wow`, or `yawn`
with files relative to the skin directory. Missing keys use the shared defaults
in `static/plugins/bongo-cat/default/`. A configured file that fails to load
logs an error and produces no sound; it does not fall back.

### Validation

Validation checks that required entries exist; it does not fetch every file. A
missing required entry hides the companion, shows an error in the settings tab,
and leaves the skin dropdown available. There is no fallback companion.

### Creating a Skin

1. Create `static/plugins/bongo-cat/<skin-id>/` for the images.
2. Create `static/plugins/bongo-cat/<skin-id>.json`.
3. Add the ID to `plugin-bongo-cat.skins`.
4. Run `npm run optimize:bongo`.
5. Reload and select the skin in the settings tab.

### Artwork

Export each part at 640×620, a 4× render of the 160×155 companion area, on the
same full canvas so poses line up. The full artboard is 160×170 with viewBox
`0 -15 160 170`. Hats are 640×240 sources drawn at 160×60 with
`y = -15 + hatOffset`; keep transparent margins so they align with the head.

Overlay snacks are 640×620 sources drawn at 160×155. Rain snacks are 640×310
sources drawn at 160×77.5. Both render full-width above the companion.

The standalone artboard at `static/plugins/bongo-cat-artboard.html` previews
layer order, positions, and pivots.

### Adding a Snack

Edit `static/plugins/bongo-cat/snacks.json` and add images under
`static/plugins/bongo-cat/snacks/`.

```json
{
  "snacks": [
    {
      "id": "my_overlay",
      "name": "My Overlay Snack",
      "image": "my_overlay.webp",
      "type": "food",
      "render": "overlay",
      "bitten": "my_overlay_bite.webp"
    },
    {
      "id": "my_rain",
      "name": "My Rain Snack",
      "image": "my_rain.webp",
      "type": "drink",
      "render": "rain"
    }
  ]
}
```

| Field    | Meaning                                              |
| -------- | ---------------------------------------------------- |
| `id`     | Unique snack ID. Duplicate IDs are ignored.          |
| `name`   | Display and accessibility name.                      |
| `image`  | Filename relative to `snacks/`.                      |
| `type`   | `food` or `drink`; controls sound and care effects.  |
| `render` | `overlay` or `rain`.                                 |
| `bitten` | Optional overlay image used halfway through feeding. |

Overlay snacks stay in place during feeding; rain snacks scroll through the art
area. Bitten sprites apply only to overlay snacks. Food restores more hunger and
adds mood; drink reduces tiredness. Invalid entries and duplicate IDs are
ignored. If no valid snacks load, feeding uses the generic food bonus and the
default eat sound.

### Adding a Hat

Edit `static/plugins/bongo-cat/hats.json` and add images under
`static/plugins/bongo-cat/hats/`.

```json
{
  "hats": [
    {
      "name": "My Hat",
      "id": "my_hat",
      "file": "my_hat.webp"
    }
  ]
}
```

| Field  | Meaning                                            |
| ------ | -------------------------------------------------- |
| `id`   | Unique unlock key stored in saved companion state. |
| `name` | Display name in the hat picker.                    |
| `file` | Filename relative to `hats/`.                      |

Hats are 640×240 sources drawn at 160×60 in the head group, after the head and
before the eyes. Invalid entries and duplicate IDs are ignored. If the catalog
is empty or invalid, no hats are available and Roll Hat is disabled.

The companion earns one roll per level, for 20 rolls at the level cap. A new hat
auto-equips only when nothing is equipped. Duplicate rolls grant 5 XP. Reset is
the intended way to keep hunting for missing hats after level 20.
