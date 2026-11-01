# Bongo Companions

A floating desk companion that reacts to typing, chat activity, and the built-in
radio. The companion starts hidden; use the Bongo Companion settings tab to show
it.

## Enable

Add the plugin to the top-level `plugins` array in `config.json`:

```json
"plugins": [
    { "name": "bongo-cat", "url": "static/plugins/bongo-cat.html" }
]
```

The default config template includes this entry. Remove it from `plugins` to
disable the plugin.

## Configuration

### Skins

The optional `plugin-bongo-cat` section selects which skins users may choose
from:

```json
"plugin-bongo-cat": {
    "skins": ["crabstacean"]
}
```

- `skins` is optional and defaults to `["crabstacean"]`.
- An explicit empty array disables the plugin entirely.
- Each ID loads `static/plugins/bongo-cat/<skin-id>.json`.
- The settings dropdown lists the IDs in `skins`.
- The selected skin is stored under `kiwiirc.bongo-cat`.
- A missing or invalid skin hides the companion and shows an error in the Bongo
  Companion settings tab. The dropdown remains available. There is no fallback
  companion.

### Visibility & Care

- Companions start hidden. Use the Bongo Companion settings tab to show one.
- While hidden, Professor Bongo looks after the companion. Hunger, tiredness,
  and mood do not decay, and active XP does not accrue.
- Hiding and showing reset the care clocks, so hidden time does not create a
  decay backlog.

### Progression

- Maximum level: 20. XP caps at 1,900 and the level bar shows 100% at max.
- Daily login: +10 XP.
- Active XP: +5 XP per 10 minutes of actual input activity.
- Vibing XP: +1 XP per 10 minutes while the companion is dancing to music.
- Active and vibing XP require a visible tab and share a 60 XP daily cap.
- Daily login XP is separate from that 60-point cap.
- Active XP takes precedence over vibing XP in the same window.
- Hidden companions, idle periods, and background tabs do not accrue active or
  vibing XP.
- Reset clears XP, hats, daily XP counters, and progress.

### Placement

- Position can be set to **Bottom Right** (default) or **Top Right**.
- Bottom placement opens the stats card upward; top placement opens it downward.
- A quick position button is available in the stats card next to the sound
  toggle.
- The position is stored with the companion state and is preserved by reset.
- On short viewports, the stats card becomes a scrollable top overlay so it
  remains usable.

## Customization

No plugin code changes are needed. Add the assets, edit the relevant JSON, and
reload the page. `static/` is copied to `dist/static/` on a production build.

### Image Optimization

The plugin loads lossy WebP files at runtime. Artists provide full-canvas PNG
sources, and `npm run optimize:bongo` generates sibling `.webp` files with
ImageMagick:

```bash
npm run optimize:bongo
WEBP_QUALITY=82 npm run optimize:bongo
npm run optimize:bongo -- --force
```

The default quality is 85 with full-quality alpha. The script skips up-to-date
outputs unless `--force` is given, and `--verbose` lists each conversion.
Commit both formats: the PNGs remain the editable source and are used by the
standalone artboard, while the `.webp` files are what the companion loads.

### Adding Skins

1. Create `static/plugins/bongo-cat/<skin-id>/` for the images.
1. Create `static/plugins/bongo-cat/<skin-id>.json`.
1. Add the ID to `plugin-bongo-cat.skins` in `config.json`.
1. Reload the page and select the skin in the Bongo Companion settings tab.

Skin JSON:

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

Asset paths are relative to the skin directory. Remove the `legs`, `ears`, or
`tail` blocks when their feature is disabled.

Required assets:

| Asset      | Files                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| Body       | `body.webp`                                                                                                                |
| Head       | `head.webp`                                                                                                                |
| Eyes       | `eyes.webp`, `eyes_blink.webp`, `eyes_tired.webp`, `eyes_happy.webp`, `eyes_worried.webp`, `eyes_sleep.webp`, `eyes_grumpy.webp` |
| Mouth      | `mouth.webp`, `mouth_smile.webp`, `mouth_frown.webp`, `mouth_yawn.webp`, `mouth_open.webp`                                     |
| Left hand  | `hand_l_up1.webp`, `hand_l_up2.webp`, `hand_l_down.webp`                                                                     |
| Right hand | `hand_r_up1.webp`, `hand_r_up2.webp`, `hand_r_down.webp`                                                                     |

Feature-dependent assets:

| Feature | Required files                                                                       |
| ------- | ------------------------------------------------------------------------------------ |
| `legs`  | `legs_idle1.webp`, `legs_idle2.webp`, `legs_sleep.webp`                                 |
| `ears`  | `ears.webp`, `ears_perked.webp`, `ears_tucked.webp`                                     |
| `tail`  | `tail.webp`, `tail_happy.webp`, `tail_tired.webp`, `tail_grumpy.webp`, `tail_tucked.webp` |

Feature flags default to `false` when omitted. `earsInFront` moves the ears
after the hat but before the eyes.

Asset creation:

- Provide transparent RGBA PNGs as source art. Run `npm run optimize:bongo` to
  generate the `.webp` runtime files, and reference those in the skin JSON.
- Export at 640×620, a 4× render of the `160 × 155` companion art area.
- The full artboard is `160 × 170` with viewBox `0 -15 160 170`.
- Keep every pose on the same full canvas so parts line up when swapped.
- Keep body, head, eyes, mouth, hands, legs, ears, and tail separate.
- Do not bake in the ground shadow; the plugin draws it.
- Draw order is tail, legs, body, head group, then hands. Inside the head group:
  ears behind, head, hat, ears in front when enabled, eyes, mouth.

Pivots are in viewBox units. Defaults are head `80,80`, left arm `50,103`, right
arm `110,103`, and tail `112,99`.

`hatOffset` moves equipped hats down from the top of the canvas. `0` is the
default position.

Optional `sounds` override `eat`, `drink`, `laugh`, `snore`, `wow`, or `yawn`
with filenames relative to the skin directory. Missing sounds use the shared
defaults in `static/plugins/bongo-cat/default/`. The shared defaults are 22.05
kHz 8-bit mono WAV files.

`name` is optional metadata. The settings dropdown uses the configured skin ID.

A skin missing any required asset fails validation: the companion is hidden, the
settings tab shows an error, and the dropdown remains available. There is no
fallback companion.

The standalone artboard at `static/plugins/bongo-cat-artboard.html` is hardcoded
to Crabstacean and uses the full-canvas PNG sources. It remains useful for
inspecting layer order, positions, and pivot points. It also previews optional
tail images from `static/plugins/bongo-cat/crabstacean/` when they exist.

### Adding Snacks

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

Fields:

| Field    | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| `id`     | Unique snack ID. Duplicate IDs are ignored.                    |
| `name`   | Display and accessibility name.                                |
| `image`  | Image filename relative to `snacks/`.                          |
| `type`   | `food` or `drink`. Controls sound and care effects.            |
| `render` | `overlay` or `rain`.                                           |
| `bitten` | Optional alternate overlay image used halfway through feeding. |

Asset creation:

- Provide transparent RGBA PNGs as source art and reference the generated
  `.webp` files in `snacks.json`.
- Overlay images: 640×620 RGBA, drawn at `160 × 155`, transparent background.
- Rain images: 640×310 RGBA, drawn at `160 × 77.5`, transparent background.
- Both render at full width and are topmost above the companion and effects.
- Overlay snacks stay in place for the feeding animation.
- Rain snacks scroll through the art area.
- Bitten sprites apply only to overlay snacks; the plugin swaps to the bitten
  image halfway through.

Current effects:

- Food: hunger −30, tiredness +2, mood +4, and the `eat` sound.
- Drink: hunger −20, tiredness −5, mood +2, and the `drink` sound.

Invalid entries and duplicate IDs are ignored. If no valid snacks load, feeding
uses the generic food bonus, plays `eat.wav`, and shows no overlay. Valid snacks
are selected uniformly at random.

### Adding Hats

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

Fields:

| Field  | Meaning                                            |
| ------ | -------------------------------------------------- |
| `id`   | Unique unlock key stored in saved companion state. |
| `name` | Display name in the hat picker.                    |
| `file` | Image filename relative to `hats/`.                |

Asset creation:

- Provide transparent RGBA PNGs at 640×240 as source art and reference the
  generated `.webp` files in `hats.json`.
- Hats draw at `160 × 60` with `y = -15` plus the skin's `hatOffset`.
- They occupy the top 60 units of the `160 × 170` artboard.
- The hat layer renders inside the head group, after the head and before the
  eyes, so it follows head movement and stays under the eyes.
- The image is full-width; transparent margins keep it aligned with the head.

Invalid entries and duplicate IDs are ignored. If the catalog is missing, empty,
or invalid, no hats are available and the Roll Hat button is disabled.

Added hats enter the roll pool. The companion earns one roll per level, for 20
rolls at the level cap. A new hat auto-equips only when nothing is equipped.
Duplicate rolls grant +5 XP. Resetting is the intended way to hunt for hats
still missing after level 20.

## Features

- Floating companion with idle animation, typing taps, blinking, sleeping,
  reactions, radio modes, and feeding animations.
- Hunger, tiredness, mood, snacks, naps, petting, and cooldowns.
- Inactivity sleep pauses tiredness growth without reducing it. Naps and drink
  snacks are the recovery methods.
- Daily, active-use, and music-vibing XP with a level 20 cap.
- Configurable skins, snacks, and hats.
- Rate-limited reactions to messages, highlights, disconnects, reconnects, and
  Twitch user notices.
- Settings for skin, name, sounds, volume, size, position, visibility,
  cosmetics, and reset.
- Reduced-motion support and accessible controls.

## Persistence

State is stored in browser `localStorage` under the single stable key
`kiwiirc.bongo-cat`.

### Multiple Windows and Tabs

Companion state is shared by all Kiwi IRC windows and tabs on the same browser
origin, including pages loaded with different `?config=` values. Tabs do not
synchronize in real time, and each keeps its own in-memory copy. With multiple
tabs open, the last tab to save can overwrite changes from another tab, so care
values, cooldowns, XP, hats, visibility, and the selected skin may become
inconsistent. Pages using different `plugin-bongo-cat.skins` lists may also
disagree about the selected skin. Use one tab per browser when consistent saved
state matters.
