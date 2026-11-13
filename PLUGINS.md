# Plugin Development

Kiwi IRC plugins are small HTML or JavaScript files that extend the running
client through the global `kiwi` API. They can add interface elements, settings
tabs, sidebar panels, message renderers, media players, and services for other
plugins to consume.

This document is for plugin authors. For the `plugins` configuration key, see
[CONFIGURATION.md](CONFIGURATION.md).

Plugins are trusted code. Plugin HTML is injected into the page and plugin
scripts run with the same privileges as Kiwi IRC itself. Only load plugins you
trust.

## Quick Start

1. Copy `static/plugins/customise.html.example` to
   `static/plugins/my-plugin.html`.
2. Add a `kiwi.plugin()` callback and a small component.
3. Add the plugin to the `plugins` array in `config.json`.
4. Reload the client and check the browser console.

A minimal channel-header button:

```html
<template id="my-plugin-button">
 <a @click="hello" title="Say hello">
  <i aria-hidden="true" class="bx bx-smile">
  </i>
 </a>
</template>
<script>
 kiwi.plugin('my-plugin', (kiwi, log) => {
    const Button = kiwi.Vue.extend({
        template: '#my-plugin-button',
        methods: {
            hello() {
                log.info('Hello from my-plugin');
            },
        },
    });

    kiwi.addUi('header_channel', Button);
});
</script>
```

Enable it:

```json
"plugins": [
    { "name": "my-plugin", "url": "static/plugins/my-plugin.html" }
]
```

`name` is a label used in logs and the plugin container. `url` points at the
plugin file. If your config already defines `plugins`, add the entry to that
array. If it does not, the built-in template list is active; defining `plugins`
in your config replaces that list, so include any bundled plugins you still
want.

The default log level is error, so `log.info()` output is hidden until you raise
it. See [Debugging](#debugging) for the log-level call.

During development, `npm run dev` serves `static/` directly. A production
`npm run build` copies `static/` into `dist/static/`.

## How Plugins Load

The `plugins` array is processed in order. Each entry is an object:

```json
{
  "name": "my-plugin",
  "url": "static/plugins/my-plugin.html"
}
```

A URL containing `.js` is loaded as a script. Every other URL is treated as an
HTML plugin.

### HTML Plugins

HTML plugins are fetched and injected into a hidden `<div>` with an id based on
the plugin name. The injected HTML is not sanitised. Stylesheets and scripts in
the plugin are made live:

- `<template>` blocks are available to Vue but are not rendered directly.
- `<style>` blocks apply globally.
- `<link rel="stylesheet" href="...">` URLs are resolved relative to the plugin
  HTML file.
- `<script src="...">` URLs are resolved relative to the plugin HTML file.
- Inline and external scripts are re-inserted as live script elements.
- External scripts are loaded in document order with `async = false`.
- The next plugin waits for the current HTML plugin's external scripts to
  finish.

### JavaScript Plugins

A `.js` plugin is inserted as a normal script tag. It has no HTML template or
style injection, so it must define its own component templates and add any
styles itself.

### Errors and Ordering

Plugin loading is sequential. A failed fetch or script load is logged and the
next plugin is attempted. Errors thrown by a plugin callback are logged and do
not stop startup.

Plugin order matters. A later plugin can use a service, UI slot, or module
registration made by an earlier plugin. Resolve services at call time rather
than assuming a particular load order.

### Lifecycle

Plugins call `kiwi.plugin(name, callback)`. The callback receives the `kiwi` API
and a namespaced logger:

```js
kiwi.plugin('my-plugin', (kiwi, log) => {
    // Set up the plugin here.
});
```

During initial loading, callbacks are queued and run when Kiwi emits `init`.
Once `init` has run, new registrations execute immediately. A successful
callback emits the `plugin.loaded` state event with `{ name }`.

The callback is not awaited. If it is `async`, handle its errors yourself.

Plugin files execute before the Vue application is mounted. Do not assume the
main interface exists while the file is being evaluated. Use the callback, or
listen for `kiwi.on('ready', ...)`, before querying or modifying the DOM.

## Plugin Anatomy

An HTML plugin is a normal HTML fragment with optional template, script, and
style blocks:

```html
<template id="my-plugin-panel">
 <div class="my-plugin-panel">
  {{ $t('my-plugin:hello') }}
 </div>
</template>
<script>
 kiwi.plugin('my-plugin', (kiwi, log) => {
    const Panel = kiwi.Vue.extend({
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

Template IDs and CSS classes are global. Prefix both with the plugin name to
avoid collisions.

HTML plugins may load external assets:

```html
<link href="my-plugin.css" rel="stylesheet"/>
<script src="my-plugin.js">
</script>
```

The browser does not treat `<i />` as self-closing. Use `<i></i>`.

Static plugins are not transpiled or bundled. Use browser-supported JavaScript
and do not use `import` or `export`; use `kiwi.require()` for application
modules. The bundled plugins use modern `const`, `let`, and arrow functions.
Static `.js` plugin files are linted as browser scripts, but inline `<script>`
blocks in HTML plugins are not.

Kiwi uses Vue 2.7 with the options API. `data` must be a function, and new
reactive object keys need `kiwi.Vue.set()` or `kiwi.Vue.delete()`. Use
`kiwi.Vue.observable()` for shared reactive state.

## Core API

| Member                                         | Description                                          |
| ---------------------------------------------- | ---------------------------------------------------- |
| `kiwi.version`                                 | Kiwi IRC version string.                             |
| `kiwi.commithash`                              | Build commit hash.                                   |
| `kiwi.versionMatches(version)`                 | True when the running version is at least `version`. |
| `kiwi.Vue`                                     | Vue 2 constructor and helpers.                       |
| `kiwi.JSON5`                                   | JSON5 parser, loaded before plugin scripts run.      |
| `kiwi.state`                                   | Running application state singleton.                 |
| `kiwi.themes`                                  | Theme manager.                                       |
| `kiwi.i18n`                                    | i18next instance.                                    |
| `kiwi.vueI18n`                                 | Vue I18n instance.                                   |
| `kiwi.media`                                   | Reactive aggregate media state.                      |
| `kiwi.layout.insets`                           | Reactive viewport-edge chrome insets.                |
| `kiwi.setLayoutInsets(source, insets)`         | Reserve viewport edges for a chrome provider.        |
| `kiwi.clearLayoutInsets(source)`               | Remove a chrome provider's insets.                   |
| `kiwi.getLayoutInsets()`                       | Read a copy of the combined insets.                  |
| `kiwi.log`                                     | Shared logger.                                       |
| `kiwi.logLevel(level)`                         | Set the global log level.                            |
| `kiwi.require(path)`                           | Load an exported application module.                 |
| `kiwi.plugin(name, callback)`                  | Register a plugin.                                   |
| `kiwi.registerCommand(name, handler)`          | Register an input command.                           |
| `kiwi.addAutocompleteProvider(name, provider)` | Register local completion.                           |
| `kiwi.addSettingsBlock(type, component, args)` | Add a settings block.                                |
| `kiwi.on/off/once/emit`                        | Event emitter methods.                               |

### Importing Modules

Only source modules whose source contains `'kiwi public'` are exported to
plugins. Load them by path relative to `src/`, without an extension:

```js
const TextFormatting = kiwi.require('helpers/TextFormatting');
const ChannelList = kiwi.require('components/ChannelList');
const Utils = kiwi.require('helpers/Utils');
```

`kiwi.require()` logs an error and returns `undefined` when a module is not
exported.

Useful modules include:

- `helpers/TextFormatting` — `t`, `formatText`, `formatUser`, `formatAndT`,
  `formatNumber`.
- `helpers/Utils` — `find`, `filter`, `each`, `getPath`, `escapeHtml`,
  `deepClone`, `sortBy`.
- `helpers/Async` — `debounce`, `throttle`.
- `helpers/Misc` — URL, connection, and media helpers.
- `helpers/CommandTree` — token suggestions, path resolution, syntax, and
  delivery for `suggest-*` plugins.
- `components/ChannelList` — channel-list component.
- `components/AppSettings` — settings view component.
- `libs/bufferTools` — buffer helpers.

Do not add npm dependencies for a static plugin. Use browser APIs and the
in-house helpers exposed through `kiwi.require()`.

## State and Buffers

Read configuration through `kiwi.state.setting()`:

```js
const enabled = kiwi.state.setting('plugin-my-plugin.enabled');
```

`setting(name)` checks browser user settings first, then the merged
configuration. Write user overrides with `setting(name, value)`. Writing a value
that matches the administrator default removes the user override.

Other useful state calls:

```js
kiwi.state.getActiveNetwork();
kiwi.state.getActiveBuffer();
kiwi.state.getNetwork(networkId);
kiwi.state.getUser(networkId, nick);
kiwi.state.$on('event', handler);
kiwi.state.$off('event', handler);
kiwi.state.$emit('event', payload);
```

`buffer.setting(name)` reads a buffer-level setting. Do not mutate network,
buffer, user, or message internals directly unless the state API has no suitable
method; internal fields and reactivity assumptions can change.

The message array on a buffer is not reactive. Individual `Message` objects are
reactive. Use the state and buffer helpers rather than replacing arrays.

`network.setting(name)` and `network.setting(name, value)` read and write
per-network settings. They behave like `state.setting()` but are scoped to one
network.

## Input Commands

`kiwi.registerCommand(name, handler)` registers a client-side input command
without the leading slash. Command names are matched case-insensitively.

```js
kiwi.registerCommand('hello', (event, command, params, context) => {
    event.handled = true;
    kiwi.state.$emit('input.raw', '/msg ' + context.buffer.name + ' Hello', context);
});
```

The handler receives `(event, command, params, context)`. Set
`event.handled = true` to stop the core command handler and raw IRC fallback.

Plugin commands run after the `input.command.<name>` event and before built-in
commands. Unhandled commands continue through the normal core handling. Handler
errors are logged and do not abort input processing.

Commands that need the normal message path can re-emit `input.raw` with the
original context, as in the example. This preserves pending-message, local echo,
and alias handling.

## UI Hooks

### `addUi(type, component, args)`

Adds a Vue component to a host slot:

```js
kiwi.addUi('header_channel', Button, {
    title: 'My Button',
    props: {
        mode: 'compact'
    },
});
```

`component` may be a Vue component options object or a `Vue.extend` result.
Passing a mounted `$el` is deprecated; pass the component object.

`args.props` are bound to the component. `args.title` is used by slots that
render a section heading. A title beginning with `t_` is translated with the
remainder as the translation key.

Host components add context props in addition to `args.props`. They also pass a
single `pluginProps` object containing the same context in one place.

| Type             | Where it renders                            | Host props                                   | `pluginProps`                          |
| ---------------- | ------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| `app`            | App root, across buffers and settings views | `network`, `buffer`                          | `{ network, buffer, activeComponent }` |
| `input`          | Chat input button row                       | `network`, `buffer`                          | `{ buffer, controlinput }`             |
| `browser`        | State browser tools                         | `networks`, `sidebar-state`                  | `{ statebrowser }`                     |
| `header_channel` | Channel header                              | `network`, `buffer`, `sidebar-state`         | `{ buffer, containerheader }`          |
| `header_query`   | Query header                                | `network`, `buffer`, `sidebar-state`         | `{ buffer, containerheader }`          |
| `userbox_button` | User profile actions                        | `network`, `buffer`, `user`, `sidebar-state` | `{ user, userbox }`                    |
| `userbox_info`   | User profile information                    | `network`, `buffer`, `user`, `sidebar-state` | `{ user, userbox }`                    |
| `userbox_whois`  | User profile WHOIS area                     | `network`, `buffer`, `user`, `sidebar-state` | `{ user, userbox }`                    |
| `about_buffer`   | Buffer About pane                           | `network`, `buffer`, `sidebar-state`         | `{ buffer, aboutbuffer }`              |
| `message_info`   | Message info panel                          | `buffer`, `message`                          | `{ buffer, message }`                  |

Unknown slot types are ignored. Hosts also apply layout classes such as
`kiwi-header-option`, `kiwi-controlinput-button`, `kiwi-statebrowser-tool`, and
`u-link kiwi-messageinfo-button`.

### `addTab(type, title, component, props)`

Adds a tab to a tabbed view:

- `channel` — channel sidebar tab.
- `settings` — application settings tab.
- `server` — server view tab.

`title` is used as the tab header and tab name. A title beginning with `t_` is
translated with the remainder as the translation key.

| Type       | Host props                           | Notes                                                    |
| ---------- | ------------------------------------ | -------------------------------------------------------- |
| `channel`  | `network`, `buffer`, `sidebar-state` | Rendered in the channel sidebar.                         |
| `settings` | none                                 | Only `props` are bound; read state through `kiwi.state`. |
| `server`   | `network`                            | Rendered in the server view.                             |

Unknown tab types are ignored.

### `addSettingsBlock(type, component, args)`

Adds a plugin-owned block to the bottom of an existing settings tab without
creating a new tab. Use this when a plugin only has a few settings.

- `general` — bottom of the General settings tab. The component receives no
  `network` prop, and `pluginProps` is an empty object.
- `network` — bottom of the active-network settings tab. The component receives
  the active `network` prop and `pluginProps.network`.

`args.title` is optional and uses the same `t_` translation convention. An empty
title omits the heading. `args.props` binds additional props. Blocks render in
registration order after the built-in blocks.

The host wraps the component in `.kiwi-appsettings-block`. Render the contents
using `.kiwi-appsettings-section` so the block matches the built-in settings.

```html
<template id="my-plugin-settings">
 <div class="kiwi-appsettings-section">
  <label class="u-checkbox-wrapper">
   <span>
    My plugin setting
   </span>
   <input type="checkbox" v-model="enabled"/>
  </label>
 </div>
</template>
<script>
 kiwi.plugin('my-plugin', (kiwi) => {
    kiwi.addTranslations('my-plugin', {
        'en-us': { settings: 'My Plugin' },
    });

    const Settings = kiwi.Vue.extend({
        template: '#my-plugin-settings',
        props: ['network'],
        computed: {
            enabled: {
                get() {
                    return !!this.network.setting('plugin-my-plugin.enabled');
                },
                set(value) {
                    this.network.setting('plugin-my-plugin.enabled', value);
                },
            },
        },
    });

    kiwi.addSettingsBlock('network', Settings, {
        title: 't_my-plugin:settings',
    });
 });
</script>
```

Register blocks during plugin startup, like other UI hooks. Unknown block types
are ignored.

### `addView` and `showView`

`kiwi.addView(name, component, props)` registers a full-workspace component.
`kiwi.showView(name)` shows it, and `kiwi.showView(null)` closes it and returns
to the buffers.

The component receives only `props`. The active view replaces the buffer and
input area while it is open. Use a unique name; registering the same name again
replaces the previous view.

### Sidebar Components

`kiwi.showInSidebar(component, props, id)` shows a component in the sidebar.
`kiwi.toggleInSidebar(id, component, props)` opens it, or closes it when the
component with that id is already open.

Use a stable `id`, usually the plugin name, so the plugin can recognise its own
sidebar content. The component receives `network`, `buffer`, and `sidebar-state`
in addition to `props`. `sidebarState.isComponentOpen(id)` is available for
checking state.

`kiwi.state.ui.sidebar_open` and `sidebar_section` describe the sidebar that is
actually visible. When a full-page active view replaces the buffer area, both
are cleared even if a sidebar was open underneath.
`kiwi.state.ui.active_view_open` is true while such a view is open. Overlays
near the right edge can treat `active_view_open || sidebar_open` as an occupied
sidebar.

### Startup Screens

`kiwi.addStartup(name, component)` registers a startup screen. Select it with
`startupScreen: "name"` in configuration.

The component is responsible for creating or restoring a network and emitting
`start` when it is ready. The event may include a fallback component:

```js
this.$emit('start', {
    fallbackComponent: MyFallback,
    fallbackComponentProps: {
        reason: 'No network'
    },
});
```

Plugins load before the startup screen is selected, so registration works for
the initial page load. An unknown startup name throws a startup error.

### Replacing Modules

`kiwi.replaceModule(path, source)` replaces all properties on an exported
application module with the properties from `source`. It throws when the module
does not exist.

This is an advanced hook. Replacing a module can break internal assumptions and
other plugins. Prefer UI hooks, services, or events when they are sufficient.

## Autocomplete Providers

`kiwi.addAutocompleteProvider(name, provider)` adds local input completion,
without touching the remote `+draft/autocomplete-request` path.

```js
kiwi.addAutocompleteProvider('my-suggestions', {
    suggest({
        input,
        token,
        network,
        buffer
    }) {
        return {
            active: true,
            items: [{
                text: 'join',
                description: 'admin join',
                type: 'command'
            }],
            filter: token,
            filtering: true,
        };
    },

    hint({
        input,
        network,
        buffer
    }) {
        return 'admin join <channel>';
    },
});
```

`active: true` means the provider owns the current input. The host opens the
suggestion list when `items` is non-empty, and closes it when `items` is empty.
Return `null` or `undefined` to let later providers and built-in completions
run.

`items` uses the same fields as the autocomplete component: `text`,
`description`, `help`, `type`, `filterText`, `insertText`, and optional icon
fields. `filter` defaults to the current token; `filtering` defaults to `true`.

Providers run in registration order and the first active result wins. `hint()`
is called separately while rendering; the first non-empty string is shown as the
input syntax hint. Hints may return `''`.

Register providers during plugin startup, like other UI hooks.

## Configuration

`kiwi.setConfigDefaults(namespace, defaults)` writes missing values under
`settings.<namespace>`:

```js
kiwi.setConfigDefaults('plugin-my-plugin', {
    enabled: true,
    accent: 'blue',
});

const enabled = kiwi.state.setting('plugin-my-plugin.enabled');
```

Existing administrator values and user overrides are not overwritten. Read with
`kiwi.state.setting()`, and write user choices with
`kiwi.state.setting(name, value)`.

Plugin defaults are not automatically added to `configTemplates.js`; call
`setConfigDefaults()` from the plugin when it needs defaults. The bundled radio
plugin does this.

Configuration is public. Never put passwords, tokens, SASL secrets, or user
hashes in plugin configuration.

## Translations

Register inline translations under a namespace:

```js
kiwi.addTranslations('my-plugin', {
    'en-us': {
        hello: 'Hello',
    },
});
```

Use them in templates:

```html
{{ $t('my-plugin:hello') }}
```

External translation files are also supported:

```js
kiwi.addTranslationFiles(
    'my-plugin',
    'static/plugins/my-plugin/locales/{{lng}}.json', {
        hello: 'Hello'
    }
);
```

The URL must contain `{{lng}}`. `{{ns}}` is also supported. The optional third
argument supplies an `en-us` fallback bundle.

A tab or section title beginning with `t_` is translated with the remainder as
the key. Namespace-qualified keys such as `my-plugin:title` work there too.

## Media Playback

Plugins that play audio or video can report it centrally:

```js
kiwi.setMediaPlaying('my-player', true, {
    title: 'Song name',
    display: 'Song name — Artist',
});

kiwi.setMediaPlaying('my-player', false);
```

`display` is an optional ready-to-render string for status bars. Consumers use
`kiwi.getMediaDisplay(source)`, which falls back to `title` and then `station`.

- `kiwi.media.playing` is true while any registered source is playing.
- `kiwi.media.sources` is the reactive source map.
- `kiwi.isMediaPlaying()` returns the aggregate state.
- `kiwi.getMediaSource(source)` returns one source's metadata.
- `kiwi.getMediaDisplay(source)` returns the display string with fallbacks.
- `kiwi.getMediaSources()` returns the source map.
- `kiwi.clearMediaSource(source)` removes a source.
- `kiwi.on('media.playing', handler)` fires when the aggregate state changes.

Multiple plugins may report playback at once. The aggregate stays true until
every source has stopped. The `media.playing` event fires only when the
aggregate changes, not when metadata changes while playback continues.

## Services

Plugins can expose a named service for other plugins:

```js
kiwi.registerService('my-service', {
    enabled: () => true,
    open: () => {},
});

const service = kiwi.getService('my-service');
if (service && service.enabled()) {
    service.open();
}
```

`getService()` returns `null` when the service is not loaded, so check at call
time. Registering the same name again replaces the earlier service.

The bundled radio plugin registers a `radio` service with `enabled()`,
`getRadio()`, and `openBrowser()`.

## Layout Chrome Insets

Plugins that add fixed chrome around the layout can reserve the viewport edges
it occupies. Other plugins can then position overlays inside the remaining
content area.

Insets are CSS pixels. Missing or invalid edges are treated as `0`. Multiple
providers are combined by taking the maximum value for each edge.

```js
kiwi.setLayoutInsets('my-chrome', {
    top: 48,
    right: 12,
    bottom: 32,
    left: 12,
});

// Remove the reservation when the chrome is disabled.
kiwi.clearLayoutInsets('my-chrome');
```

`setLayoutInsets()` returns an unsubscribe function:

```js
const clear = kiwi.setLayoutInsets('my-chrome', insets);
// later
clear();
```

Consumers can read reactive state from a Vue component:

```js
computed: {
    insetBottom() {
        return kiwi.layout.insets.bottom;
    },
},
```

Or read a copy from plain JavaScript:

```js
const insets = kiwi.getLayoutInsets();
element.style.right = (18 + insets.right) + 'px';
element.style.bottom = (88 + insets.bottom) + 'px';
```

The `layout.insets` event fires when the combined insets change. Providers must
register after their chrome is visible, update on layout changes, and clear
their source when the chrome is removed or the plugin is deactivated. The
NephWave and NephDeck chrome plugins and the Bongo Companion are reference
implementations.

## Events

`kiwi` is an event emitter. Listen with `kiwi.on()` and remove listeners with
`kiwi.off()` when the component is destroyed. `once()` and `emit()` are also
available.

State events are forwarded through `kiwi`.
`kiwi.on('all', (eventName, ...args))` receives every forwarded state event.
`kiwi.emit()` forwards an event into the state as well as to plugin listeners.

Common events:

| Event                                   | Payload                                |
| --------------------------------------- | -------------------------------------- |
| `message.new`                           | `{ message, buffer }`                  |
| `message.render`                        | `{ message }`                          |
| `message.prestyle`, `message.poststyle` | `{ message, blocks }`                  |
| `message.blocks`                        | `{ message, blocks }`                  |
| `message.reaction`, `message.redaction` | `{ message, buffer }`                  |
| `input.activity`                        | `{ network, buffer, textLength }`      |
| `media.playing`                         | `{ playing, source, metadata }`        |
| `layout.insets`                         | `{ top, right, bottom, left }`         |
| `plugin.loaded`                         | `{ name }`                             |
| `network.new`, `network.removed`        | `{ network }` or `{ network, source }` |
| `buffer.new`, `buffer.close`            | `{ buffer }`                           |
| `theme.change`                          | `(nextTheme, previousTheme)`           |
| `theme.failed`                          | `(failedTheme, activeTheme)`           |
| `active.component`                      | `(component, props)`                   |
| `irc.raw.<COMMAND>`                     | `(command, event, network)`            |

Twitch-specific events include `twitch.notice`, `twitch.usernotice`,
`twitch.roomstate`, `twitch.reconnect`, `twitch.clearchat`, `twitch.clearmsg`,
`twitch.userstate`, and `twitch.globaluserstate`.

`input.activity` deliberately contains only the draft length, never the draft
text.

The `ready` event fires after the Vue application has mounted. Use it when a
plugin needs to query or modify the rendered interface.

## Theme API

`kiwi.themes` is the theme manager:

- `currentTheme()` returns the active theme object.
- `availableThemes()` returns the configured theme list.
- `setTheme(nameOrTheme)` switches themes.
- `reload()` reloads the current theme.
- `activeTheme` and `previousTheme` expose the current and previous themes.

Listen for `theme.change` and `theme.failed` when the plugin depends on a
specific theme. The initial theme load does not emit `theme.change`, so check
`currentTheme()` or the `data-theme` attribute at startup as well.

## Styling and Assets

- Prefer theme variables such as `--brand-primary`, `--brand-default-fg`,
  `--brand-midtone`, and `--brand-input-bg`.
- Prefix CSS classes and template IDs to avoid collisions.
- Respect `prefers-reduced-motion`.
- Use the bundled Boxicons webfont for icons: `<i class="bx bx-cog"></i>` or
  `<i class="bx bxs-star"></i>`. Font Awesome classes are not available.
- In an HTML plugin, asset URLs are resolved relative to the plugin HTML file.
- A `.js` plugin must add its own styles.
- Do not add dependencies for a static plugin; use browser APIs and
  `kiwi.require()` helpers.

## Direct DOM Integration

Some bundled theme plugins append chrome to `<body>` and toggle body classes
instead of registering Vue components. This is supported, but it is advanced:

- Wait for the interface to exist, or listen for `ready`.
- Clean up timers, observers, event listeners, audio, and DOM nodes when the
  plugin is disabled or the page unloads.
- Do not fight Vue re-renders. Append outside the managed app tree when needed.
- React to `theme.change` and `theme.failed`.

The NephDeck and NephWave desktop plugins are reference examples.

## Desktop API

The optional Electron shell exposes a `kiwi.desktop` adapter. Web builds keep
the same API shape but report `isDesktop() === false` and use browser fallbacks.

```js
if (kiwi.desktop.isDesktop()) {
    // Native HTTP avoids browser CORS restrictions.
    const response = await kiwi.desktop.http.fetch('https://example.com/data.json');
}
```

Available helpers:

- `isDesktop()`
- `http.fetch(url, options)`
- `http.uploadFile(url, file, options)`
- `http.uploadMultipart(url, fields, file, options)`
- `http.isAvailable()`
- `files.saveUrl(url)`
- `files.isAvailable()`
- `media.proxyUrl(url)`
- `media.isAvailable()`
- `secrets.status()`
- `secrets.load(stateKey)`
- `secrets.save(stateKey, values)`
- `secrets.clear(stateKey)`
- `secrets.isAvailable()`
- `profile.exportBundle(bundle, filename)`
- `profile.importBundle()`
- `profile.backup()`
- `profile.openFolder()`
- `profile.isAvailable()`

`http.fetch()` and the upload helpers return a standard `Response`. They reject
when the desktop policy blocks a URL, the request times out, or the response
exceeds the configured limit. Do not assume native HTTP is available; always
feature-detect it.

`media.proxyUrl()` returns the original URL when the proxy is unavailable or the
URL is not HTTP(S). Use it for direct image, audio, and video sources, not for
iframe embeds.

`secrets.*` is desktop-only and intended for profile credential handling. Never
log, display, or include returned secrets in plugin diagnostics. Profile bundles
may contain plaintext passwords when the user explicitly includes them.

## Security

- Plugin HTML is injected with `innerHTML` and plugin scripts execute with full
  page privileges. Only install trusted plugins.
- Do not put secrets in plugin configuration; the browser can read it.
- Do not pass untrusted text to `v-html` or `innerHTML`.
- Be careful with external scripts and stylesheets; they run in the same page.
- Sanitise URLs and user-provided content before rendering or navigating.

## Debugging

The callback receives a logger namespaced to the plugin:

```js
kiwi.plugin('my-plugin', (kiwi, log) => {
    log.info('loaded');
    log.error('something failed');
});
```

The default log level is error. Raise it during development:

```js
kiwi.logLevel(kiwi.log.LEVEL_DEBUG);
```

`kiwi.log.getLogBuffer()` returns recent log entries. `kiwi.on('all', ...)` is
useful for discovering event names and payloads. `kiwi.require()` logs missing
modules. Check the browser network panel when a plugin file or asset fails to
load.

Use `kiwi.versionMatches('2.0.0')` when a plugin depends on a newer API, and
feature-detect optional methods before calling them.

## Best Practices

- Use a unique, stable plugin name and namespace.
- Clean up listeners, timers, observers, audio, and DOM nodes.
- Resolve services at call time instead of assuming load order.
- Feature-detect optional API methods.
- Keep configuration public and free of secrets.
- Prefer theme variables, Boxicons, and scoped class names.
- Test with light and dark themes and with reduced motion enabled.
- Handle errors and avoid blocking startup.
- Prefer UI hooks and services over module replacement.

## Bundled Plugins

The default configuration enables these plugins:

| Plugin              | Documentation                                            | Demonstrates                                                                       |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `channels-sidebar`  | [Channels Sidebar](static/plugins/channels-sidebar.md)   | Header slot, `kiwi.require()`, sidebar toggling.                                   |
| `nephnet-cyberdeck` | [NephNET Cyberdeck](static/plugins/nephnet-cyberdeck.md) | Direct DOM chrome, theme events, Web Audio.                                        |
| `nephwave-desktop`  | [NephWave Desktop](static/plugins/nephwave-desktop.md)   | Direct DOM chrome, theme events, media display, service consumption.               |
| `bongo-cat`         | [Bongo Companions](static/plugins/bongo-cat.md)          | App UI, settings tab, translations, event listeners, asset loading.                |
| `radio`             | [Radio](static/plugins/radio.md)                         | Config defaults, media playback, service registration, translations, browser slot. |

The customise starter is not loaded by default:

| Starter                  | Documentation                                    | Use                                                                          |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `customise.html.example` | [Customise Starter](static/plugins/customise.md) | Copy to `customise.html` for site-specific CSS and small JavaScript changes. |
