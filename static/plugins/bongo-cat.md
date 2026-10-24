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

## Customization

No plugin code changes are needed. Add the assets, edit the relevant JSON, and
reload the page. `static/` is copied to `dist/static/` on a production build.

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
    "body": "body.png",
    "head": "head.png",
    "hands": {
      "left": {
        "up1": "hand_l_up1.png",
        "up2": "hand_l_up2.png",
        "down": "hand_l_down.png"
      },
      "right": {
        "up1": "hand_r_up1.png",
        "up2": "hand_r_up2.png",
        "down": "hand_r_down.png"
      }
    },
    "eyes": {
      "open": "eyes.png",
      "blink": "eyes_blink.png",
      "tired": "eyes_tired.png",
      "happy": "eyes_happy.png",
      "worried": "eyes_worried.png",
      "sleep": "eyes_sleep.png",
      "grumpy": "eyes_grumpy.png"
    },
    "mouth": {
      "neutral": "mouth.png",
      "smile": "mouth_smile.png",
      "frown": "mouth_frown.png",
      "yawn": "mouth_yawn.png",
      "open": "mouth_open.png"
    },
    "legs": {
      "idle1": "legs_idle1.png",
      "idle2": "legs_idle2.png",
      "sleep": "legs_sleep.png"
    },
    "ears": {
      "neutral": "ears.png",
      "perked": "ears_perked.png",
      "tucked": "ears_tucked.png"
    },
    "tail": {
      "normal": "tail.png",
      "happy": "tail_happy.png",
      "tired": "tail_tired.png",
      "grumpy": "tail_grumpy.png",
      "tucked": "tail_tucked.png"
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
| Body       | `body.png`                                                                                                                |
| Head       | `head.png`                                                                                                                |
| Eyes       | `eyes.png`, `eyes_blink.png`, `eyes_tired.png`, `eyes_happy.png`, `eyes_worried.png`, `eyes_sleep.png`, `eyes_grumpy.png` |
| Mouth      | `mouth.png`, `mouth_smile.png`, `mouth_frown.png`, `mouth_yawn.png`, `mouth_open.png`                                     |
| Left hand  | `hand_l_up1.png`, `hand_l_up2.png`, `hand_l_down.png`                                                                     |
| Right hand | `hand_r_up1.png`, `hand_r_up2.png`, `hand_r_down.png`                                                                     |

Feature-dependent assets:

| Feature | Required files                                                                       |
| ------- | ------------------------------------------------------------------------------------ |
| `legs`  | `legs_idle1.png`, `legs_idle2.png`, `legs_sleep.png`                                 |
| `ears`  | `ears.png`, `ears_perked.png`, `ears_tucked.png`                                     |
| `tail`  | `tail.png`, `tail_happy.png`, `tail_tired.png`, `tail_grumpy.png`, `tail_tucked.png` |

Feature flags default to `false` when omitted. `earsInFront` moves the ears
after the hat but before the eyes.

Asset creation:

- Use transparent RGBA PNGs.
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
to Crabstacean but remains useful for inspecting layer order, positions, and
pivot points. It also previews optional tail images from
`static/plugins/bongo-cat/crabstacean/` when they exist.

### Adding Snacks

Edit `static/plugins/bongo-cat/snacks.json` and add images under
`static/plugins/bongo-cat/snacks/`.

```json
{
  "snacks": [
    {
      "id": "my_overlay",
      "name": "My Overlay Snack",
      "image": "my_overlay.png",
      "type": "food",
      "render": "overlay",
      "bitten": "my_overlay_bite.png"
    },
    {
      "id": "my_rain",
      "name": "My Rain Snack",
      "image": "my_rain.png",
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
      "file": "my_hat.png"
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

- Use transparent RGBA PNGs at 640×240.
- Hats draw at `160 × 60` with `y = -15` plus the skin's `hatOffset`.
- They occupy the top 60 units of the `160 × 170` artboard.
- The hat layer renders inside the head group, after the head and before the
  eyes, so it follows head movement and stays under the eyes.
- The image is full-width; transparent margins keep it aligned with the head.

Invalid entries and duplicate IDs are ignored. If the catalog is missing, empty,
or invalid, no hats are available and the Roll Hat button is disabled.

Added hats enter the roll pool. The companion earns one roll per level. A new
hat auto-equips only when nothing is equipped. Duplicate rolls grant +5 XP.

## Features

- Floating companion with idle animation, typing taps, blinking, sleeping,
  reactions, radio modes, and feeding animations.
- Hunger, tiredness, mood, snacks, naps, petting, and cooldowns.
- Inactivity sleep pauses tiredness growth without reducing it. Naps and drink
  snacks are the recovery methods.
- Daily and active-session XP with levels.
- Configurable skins, snacks, and hats.
- Rate-limited reactions to messages, highlights, disconnects, reconnects, and
  Twitch user notices.
- Settings for skin, name, sounds, volume, animation intensity, size,
  visibility, cosmetics, and reset.
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
