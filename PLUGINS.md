# Plugin Authoring

Kiwi IRC plugins are small HTML files that extend the running client through the
global `kiwi` API. They are loaded from configuration and injected into the page
at runtime.

## Plugin Loading

Add the plugin to the `plugins` array in `config.json`:

```json
"plugins": [
    { "name": "my-plugin", "url": "static/plugins/my-plugin.html" }
]
```

An empty array loads no plugins. `name` is a label; `url` points at the HTML
file. The default config template includes a few bundled plugins for testing.

## Plugin File Structure

A plugin is a normal HTML fragment with optional template, script, and style
blocks:

```html
<template id="my-plugin-panel">
 <div class="my-plugin-panel">
  {{ $t('my-plugin:hello') }}
 </div>
</template>
<script>
 kiwi.plugin('my-plugin', function (kiwi, log) {
    var Panel = kiwi.Vue.extend({
        template: '#my-plugin-panel',
    });

    kiwi.addUi('app', Panel);
});
</script>
<style>
 .my-plugin-panel {
    padding: 8px;
}
</style>
```

`kiwi.plugin(name, callback)` runs the callback when Kiwi is ready. Plugins
registered after startup run immediately. The callback receives the `kiwi` API
and a logger with `log.info()`, `log.error()`, and related methods.

Static plugin files are injected with `innerHTML`. They are not transpiled or
linted as application modules, so use ES5-friendly syntax where practical and do
not rely on bundler-only features.

The browser does not treat `<i />` as self-closing. Use `<i></i>`.

## Importing Modules

A source module is only available to `kiwi.require()` when its first statement
is:

```js
'kiwi public';
```

Then plugins can load it by path:

```js
var TextFormatting = kiwi.require('helpers/TextFormatting');
var ChannelList = kiwi.require('components/ChannelList');
```

`kiwi.require()` logs an error and returns `undefined` when a module is not
exported.

## Core Objects

- `kiwi.Vue` — the Vue 2 constructor and helpers such as `Vue.extend` and
  `Vue.observable`.
- `kiwi.state` — the running application state singleton.
- `kiwi.themes` — the theme manager.
- `kiwi.i18n` — the translation instance.
- `kiwi.version` — the Kiwi IRC version string.
- `kiwi.versionMatches(version)` — version comparison helper.
- `kiwi.JSON5` — the JSON5 parser used by configuration.
- `kiwi.log` — the shared logger.

## UI Hooks

### `addUi(type, component, args)`

Adds a Vue component to a host slot. `args` may contain `props` and `title`.
Components are wrapped with `Vue.extend` and rendered by the host component.

Supported slots:

- `app` — app-level component rendered after startup, across buffers and
  settings views. Receives `network`, `buffer`, and `pluginProps` (including
  `activeComponent`).
- `input` — extra controls near the chat input.
- `browser` — extra content in the state browser.
- `header_channel` — extra channel-header controls.
- `header_query` — extra query-header controls.
- `userbox_button` — extra user-profile action buttons.
- `userbox_info` — extra user-profile information rows.
- `userbox_whois` — extra WHOIS information.
- `about_buffer` — extra content in the buffer About pane.
- `message_info` — extra content in the message info panel.

Slot-specific context props are supplied by the host component in addition to
the `props` passed in `args`. Passing a mounted `$el` is deprecated; pass a Vue
component options object.

### `addTab(type, title, component, props)`

Adds a tab to a tabbed view:

- `channel` — channel sidebar tab.
- `settings` — application settings tab.
- `server` — server view tab.

`title` is also used as the tab name. A title beginning with `t_` is translated
with the remainder as the translation key.

### `addView(name, component, props)` / `showView(name)`

Registers a full-workspace component and shows it later. `showView(null)` closes
the active component and returns to the buffers.

### `showInSidebar(component, props, id)` / `toggleInSidebar(id, component, props)`

Shows or toggles a component in the sidebar. Use a stable `id` so the plugin can
recognise its own sidebar content.

### `addStartup(name, component)`

Registers a custom startup screen that can be selected with `startupScreen` in
configuration.

### `replaceModule(path, source)`

Replaces properties on an exported application module. Use with care; this is an
advanced hook and can break internal expectations.

## Configuration

`kiwi.setConfigDefaults(namespace, defaults)` writes missing values under
`settings.<namespace>`. Read them with `kiwi.state.setting()` and write user
overrides with `kiwi.state.setting(key, value)`.

```js
kiwi.setConfigDefaults('my-plugin', {
    enabled: true,
    accent: 'blue',
});

var enabled = kiwi.state.setting('my-plugin.enabled');
```

Do not put secrets in configuration. Browser config is public.

## Translations

Register inline translations under a namespace:

```js
kiwi.addTranslations('my-plugin', {
    'en-us': {
        hello: 'Hello',
    },
});

// In a component template:
// {{ $t('my-plugin:hello') }}
```

For external translation files:

```js
kiwi.addTranslationFiles(
    'my-plugin',
    'static/plugins/my-plugin/locales/{{lng}}.json', {
        hello: 'Hello'
    }
);
```

The URL must contain `{{lng}}`; `{{ns}}` is also supported.

## Media Playback

Plugins that play audio can report it centrally:

```js
kiwi.setMediaPlaying('my-player', true, {
    title: 'Song name',
    display: 'Song name — Artist'
});
kiwi.setMediaPlaying('my-player', false);
```

`display` is an optional ready-to-render string for UI such as status bars.
Consumers should use `getMediaDisplay()`; it falls back to `title` and then
`station` when a source does not provide one.

- `kiwi.media.playing` is true while any registered source is playing.
- `kiwi.isMediaPlaying()` returns the aggregate state.
- `kiwi.getMediaSource(source)` returns metadata for one source.
- `kiwi.getMediaDisplay(source)` returns the source's display string, with
  `title` and `station` fallbacks.
- `kiwi.getMediaSources()` returns the source map.
- `kiwi.clearMediaSource(source)` removes a source.
- `kiwi.on('media.playing', handler)` fires when the aggregate state changes.

Multiple plugins may report playback at once. The aggregate stays true until
every source has stopped.

## Events

`kiwi` is an event emitter. Listen to application state events with `kiwi.on()`
and remove listeners with `kiwi.off()` when your component is destroyed.

Useful events:

- `message.new` — `{ message, buffer }`
- `input.activity` — `{ network, buffer, textLength }`
- `media.playing` — `{ playing, source, metadata }`
- `twitch.notice` — Twitch notice details
- `twitch.usernotice` — Twitch event card details
- `twitch.roomstate` — merged Twitch room state
- `twitch.reconnect` — Twitch requested reconnect
- `twitch.clearchat`, `twitch.clearmsg` — Twitch redaction events
- `twitch.userstate`, `twitch.globaluserstate` — Twitch user state

`input.activity` deliberately contains only the draft length, never the draft
text.

Plugins can also listen to the normal state events exposed by the client. Use
`kiwi.state.$on()` / `kiwi.state.$off()` when you need a state-specific event
that is not forwarded through `kiwi`.

## Styling

- Prefer the existing theme variables such as `--brand-primary`,
  `--brand-default-fg`, `--brand-midtone`, and `--brand-input-bg`.
- Prefix classes to avoid collisions.
- Respect `prefers-reduced-motion`.
- Do not add dependencies for a static plugin; use browser APIs and the in-house
  helpers exposed through `kiwi.require()`.

## Bundled Plugins

- [bongo-cat](static/plugins/bongo-cat.md)
- [channels-sidebar](static/plugins/channels-sidebar.md)
- [nephnet-cyberdeck](static/plugins/nephnet-cyberdeck.md)
- [nephwave-desktop](static/plugins/nephwave-desktop.md)
- [customise starter](static/plugins/customise.md)
