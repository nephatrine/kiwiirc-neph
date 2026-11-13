kiwi.plugin('bongo-cat', (kiwi, log) => {
    let PLUGIN_SKINS_SETTING = 'plugin-bongo-cat.skins';
    let DEFAULT_SKIN_ID = 'crabstacean';

    function normalizeSkinId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        let id = value.trim();
        return /^[A-Za-z0-9_-]+$/.test(id) ? id : '';
    }

    function normalizeSkinIds(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        let ids = [];
        value.forEach((item) => {
            let id = normalizeSkinId(item);
            if (id && ids.indexOf(id) === -1) {
                ids.push(id);
            }
        });
        return ids;
    }

    let skinsSetting = kiwi.state.setting(PLUGIN_SKINS_SETTING);
    let configuredSkins = typeof skinsSetting === 'undefined'
        ? [DEFAULT_SKIN_ID]
        : normalizeSkinIds(skinsSetting);

    if (!configuredSkins.length) {
        log.info('Bongo Companion disabled: no skins configured');
        return;
    }

    kiwi.addTranslations('bongo-cat', {
        'en-us': {
            title: 'Bongo Companion',
            hint: 'Your little desk companion.',
            settings_hint: 'A little desk companion that taps along while you type.',
            settings: 'Settings',
            name: 'Name',
            hunger: 'Hunger',
            tiredness: 'Tiredness',
            mood: 'Mood',
            pet: 'Pet',
            snack: 'Snack',
            nap: 'Nap',
            mute: 'Mute',
            unmute: 'Unmute',
            hide: 'Hide',
            show_bongo_cat: 'Release Companion',
            hide_bongo_cat: 'Store Companion',
            hidden_care_hint: 'Professor Bongo is looking after {{name}}. Needs do not decay while hidden.',
            reset: 'Reset',
            reset_confirm: 'Reset Companion? This clears care, XP, and cosmetics.',
            reset_hint: "Reset your pet's current state and experience levels.",
            bongo_taps: 'Tap Sounds',
            grow_cat: 'Use Larger Companion',
            shrink_cat: 'Use Smaller Companion',
            size: 'Size',
            size_auto: 'Automatic',
            size_normal: 'Normal',
            size_larger: 'Larger',
            position: 'Position',
            position_auto: 'Automatic',
            position_bottom: 'Bottom Right',
            position_top: 'Top Right',
            move_to_top: 'Move companion to top right',
            move_to_bottom: 'Move companion to bottom right',
            skin: 'Skin',
            skin_load_error: 'Unable to load skin "{{skin}}". Choose another skin.',
            cosmetics: 'Cosmetics',
            hat: 'Hat',
            hat_none: 'No Hat',
            roll_hat: 'Roll Hat',
            hat_rolls_remaining: 'Rolls Remaining: {{count}}',
            hat_collection: 'Hats: {{count}}/{{total}}',
            hat_unlocked: 'New Hat: {{name}}!',
            hat_duplicate: 'Duplicate {{name}} — +5 XP',
            hats_unavailable: 'No hats available!',
            level_label: 'Level {{level}}',
            level_status: 'Level {{level}} · {{progress}}/{{xp}} XP',
            hunger_value: 'Hunger {{value}}%',
            tiredness_value: 'Tiredness {{value}}%',
            mood_value: 'Mood {{value}}%',
            companion_label: '{{name}}, Bongo Expert',
            snack_ready_in: 'Snack ready in {{time}}.',
            nap_ready_in: 'Nap ready in {{time}}.',
            give_snack: 'Give {{name}} a snack.',
            let_nap: 'Let {{name}} nap.',
            not_hungry: '{{name}} is not hungry right now.',
            not_tired: '{{name}} is not tired right now.',
            cooldown_minutes: '{{minutes}}m',
        },
    });

    let AppSettings = null;

    try {
        AppSettings = kiwi.require('components/AppSettings');
    } catch (err) {
        log.error('Unable to load app settings for Bongo Companion', err);
    }

    let SETTINGS_TAB_NAME = 'Bongo Companion';
    let STORAGE_KEY = 'kiwiirc.bongo-cat';
    let LEGACY_STORAGE_PREFIX = 'kiwiirc.bongo-cat.v';
    let DEFAULT_NAME = 'Bongo';
    let DEFAULT_HUNGER = 20;
    let DEFAULT_TIREDNESS = 20;
    let DEFAULT_MOOD = 80;
    let DEFAULT_VOLUME = 0.5;
    let BASE_RIGHT_OFFSET = 8;
    let BASE_BOTTOM_OFFSET = 48;
    let BASE_TOP_OFFSET = 42;
    let MIN_HUNGER = 0;
    let MIN_TIREDNESS = 0;
    let MIN_MOOD = 0;
    let XP_PER_LEVEL = 100;
    let MAX_LEVEL = 20;
    let MAX_XP = (MAX_LEVEL - 1) * XP_PER_LEVEL;
    let DAILY_XP = 10;
    let ACTIVE_XP_POINTS = 5;
    let ACTIVE_XP_MS = 10 * 60 * 1000;
    let ACTIVE_XP_CAP_MS = 30 * 60 * 1000;
    let ACTIVE_XP_DAILY_CAP = 60;
    let VIBE_XP_POINTS = 1;
    let VIBE_XP_MS = 10 * 60 * 1000;
    let VIBE_XP_CAP_MS = 30 * 60 * 1000;
    let HATS_CONFIG_PATH = 'static/plugins/bongo-cat/hats.json';
    let HATS_DIR = 'static/plugins/bongo-cat/hats/';
    let hatCatalog = kiwi.Vue.observable({
        options: [],
        map: Object.create(null),
    });
    let SKINS_DIR = 'static/plugins/bongo-cat/';
    let SKIN_DIR = SKINS_DIR + DEFAULT_SKIN_ID + '/';
    let DEFAULT_SOUNDS = {
        eat: 'static/plugins/bongo-cat/default/eat.wav',
        drink: 'static/plugins/bongo-cat/default/drink.wav',
        laugh: 'static/plugins/bongo-cat/default/laugh.wav',
        snore: 'static/plugins/bongo-cat/default/snore.wav',
        wow: 'static/plugins/bongo-cat/default/yippee.wav',
        yawn: 'static/plugins/bongo-cat/default/yawn.wav',
    };
    let DEFAULT_SKIN = {
        name: 'Crabstacean',
        body: SKIN_DIR + 'body.webp',
        head: SKIN_DIR + 'head.webp',
        hands: {
            left: {
                up1: SKIN_DIR + 'hand_l_up1.webp',
                up2: SKIN_DIR + 'hand_l_up2.webp',
                down: SKIN_DIR + 'hand_l_down.webp',
            },
            right: {
                up1: SKIN_DIR + 'hand_r_up1.webp',
                up2: SKIN_DIR + 'hand_r_up2.webp',
                down: SKIN_DIR + 'hand_r_down.webp',
            },
        },
        tail: {
            normal: '',
            happy: '',
            tired: '',
            grumpy: '',
            tucked: '',
        },
        legs: {
            idle1: SKIN_DIR + 'legs_idle1.webp',
            idle2: SKIN_DIR + 'legs_idle2.webp',
            sleep: SKIN_DIR + 'legs_sleep.webp',
        },
        ears: {
            neutral: SKIN_DIR + 'ears.webp',
            perked: SKIN_DIR + 'ears_perked.webp',
            tucked: SKIN_DIR + 'ears_tucked.webp',
        },
        eyes: {
            open: SKIN_DIR + 'eyes.webp',
            blink: SKIN_DIR + 'eyes_blink.webp',
            tired: SKIN_DIR + 'eyes_tired.webp',
            happy: SKIN_DIR + 'eyes_happy.webp',
            worried: SKIN_DIR + 'eyes_worried.webp',
            sleep: SKIN_DIR + 'eyes_sleep.webp',
            grumpy: SKIN_DIR + 'eyes_grumpy.webp',
        },
        mouth: {
            neutral: SKIN_DIR + 'mouth.webp',
            smile: SKIN_DIR + 'mouth_smile.webp',
            frown: SKIN_DIR + 'mouth_frown.webp',
            yawn: SKIN_DIR + 'mouth_yawn.webp',
            open: SKIN_DIR + 'mouth_open.webp',
        },
        features: {
            tail: false,
            legs: true,
            ears: true,
            earsInFront: false,
        },
        pivots: {
            head: { x: 80, y: 80 },
            tail: { x: 112, y: 99 },
            arms: {
                left: { x: 50, y: 103 },
                right: { x: 110, y: 103 },
            },
        },
        hatOffset: 0,
        sounds: DEFAULT_SOUNDS,
    };
    function skinConfigPath(skinId) {
        return SKINS_DIR + skinId + '.json';
    }

    function skinDirFor(skinId) {
        return SKINS_DIR + skinId + '/';
    }

    function resolveSkinAsset(skinId, file, fallback) {
        if (typeof file !== 'string' || !file) {
            return fallback;
        }
        if (file.indexOf('static/') === 0) {
            return file;
        }
        return skinDirFor(skinId) + file;
    }

    function skinHasAsset(group, key) {
        return !!group && typeof group[key] === 'string' && group[key].length > 0;
    }

    function validateSkinConfig(data) {
        if (!data || typeof data !== 'object') {
            return 'Skin configuration is not an object';
        }

        let assets = data.assets && typeof data.assets === 'object' ? data.assets : {};
        let hands = assets.hands && typeof assets.hands === 'object' ? assets.hands : {};
        let left = hands.left && typeof hands.left === 'object' ? hands.left : {};
        let right = hands.right && typeof hands.right === 'object' ? hands.right : {};
        let eyes = assets.eyes && typeof assets.eyes === 'object' ? assets.eyes : {};
        let mouth = assets.mouth && typeof assets.mouth === 'object' ? assets.mouth : {};
        let tail = assets.tail && typeof assets.tail === 'object' ? assets.tail : {};
        let legs = assets.legs && typeof assets.legs === 'object' ? assets.legs : {};
        let ears = assets.ears && typeof assets.ears === 'object' ? assets.ears : {};
        let features = data.features && typeof data.features === 'object'
            ? data.features
            : {};
        let missing = [];

        function requireAssets(group, keys, prefix) {
            keys.forEach((key) => {
                if (!skinHasAsset(group, key)) {
                    missing.push(prefix + '.' + key);
                }
            });
        }

        if (!skinHasAsset(assets, 'body')) {
            missing.push('body');
        }
        if (!skinHasAsset(assets, 'head')) {
            missing.push('head');
        }
        requireAssets(left, ['up1', 'up2', 'down'], 'hands.left');
        requireAssets(right, ['up1', 'up2', 'down'], 'hands.right');
        requireAssets(eyes, ['open', 'blink', 'tired', 'happy', 'worried', 'sleep', 'grumpy'], 'eyes');
        requireAssets(mouth, ['neutral', 'smile', 'frown', 'yawn', 'open'], 'mouth');

        if (features.tail === true) {
            requireAssets(tail, ['normal', 'happy', 'tired', 'grumpy', 'tucked'], 'tail');
        }
        if (features.legs === true) {
            requireAssets(legs, ['idle1', 'idle2', 'sleep'], 'legs');
        }
        if (features.ears === true) {
            requireAssets(ears, ['neutral', 'perked', 'tucked'], 'ears');
        }

        return missing.length
            ? 'Missing required skin assets: ' + missing.join(', ')
            : '';
    }

    function buildSkinConfig(data, skinId) {
        let source = data && typeof data === 'object' ? data : {};
        let assets = source.assets && typeof source.assets === 'object'
            ? source.assets
            : {};
        let hands = assets.hands && typeof assets.hands === 'object'
            ? assets.hands
            : {};
        let left = hands.left && typeof hands.left === 'object' ? hands.left : {};
        let right = hands.right && typeof hands.right === 'object' ? hands.right : {};
        let tail = assets.tail && typeof assets.tail === 'object' ? assets.tail : {};
        let legs = assets.legs && typeof assets.legs === 'object' ? assets.legs : {};
        let ears = assets.ears && typeof assets.ears === 'object' ? assets.ears : {};
        let eyes = assets.eyes && typeof assets.eyes === 'object' ? assets.eyes : {};
        let mouth = assets.mouth && typeof assets.mouth === 'object' ? assets.mouth : {};
        let features = source.features && typeof source.features === 'object'
            ? source.features
            : {};
        let pivots = source.pivots && typeof source.pivots === 'object'
            ? source.pivots
            : {};
        let headPivot = pivots.head && typeof pivots.head === 'object'
            ? pivots.head
            : {};
        let tailPivot = pivots.tail && typeof pivots.tail === 'object'
            ? pivots.tail
            : {};
        let arms = pivots.arms && typeof pivots.arms === 'object' ? pivots.arms : {};
        let leftPivot = arms.left && typeof arms.left === 'object' ? arms.left : {};
        let rightPivot = arms.right && typeof arms.right === 'object' ? arms.right : {};
        let sounds = {};
        Object.keys(DEFAULT_SOUNDS).forEach((key) => {
            sounds[key] = DEFAULT_SOUNDS[key];
        });
        if (source.sounds && typeof source.sounds === 'object') {
            Object.keys(DEFAULT_SOUNDS).forEach((key) => {
                let file = source.sounds[key];
                if (typeof file === 'string' && file) {
                    sounds[key] = file.indexOf('static/') === 0
                        ? file
                        : skinDirFor(skinId) + file;
                }
            });
        }

        return {
            name: typeof source.name === 'string' && source.name
                ? source.name
                : skinId,
            body: resolveSkinAsset(skinId, assets.body, ''),
            head: resolveSkinAsset(skinId, assets.head, ''),
            hands: {
                left: {
                    up1: resolveSkinAsset(skinId, left.up1, ''),
                    up2: resolveSkinAsset(skinId, left.up2, ''),
                    down: resolveSkinAsset(skinId, left.down, ''),
                },
                right: {
                    up1: resolveSkinAsset(skinId, right.up1, ''),
                    up2: resolveSkinAsset(skinId, right.up2, ''),
                    down: resolveSkinAsset(skinId, right.down, ''),
                },
            },
            tail: {
                normal: resolveSkinAsset(skinId, tail.normal, ''),
                happy: resolveSkinAsset(skinId, tail.happy, ''),
                tired: resolveSkinAsset(skinId, tail.tired, ''),
                grumpy: resolveSkinAsset(skinId, tail.grumpy, ''),
                tucked: resolveSkinAsset(skinId, tail.tucked, ''),
            },
            legs: {
                idle1: resolveSkinAsset(skinId, legs.idle1, ''),
                idle2: resolveSkinAsset(skinId, legs.idle2, ''),
                sleep: resolveSkinAsset(skinId, legs.sleep, ''),
            },
            ears: {
                neutral: resolveSkinAsset(skinId, ears.neutral, ''),
                perked: resolveSkinAsset(skinId, ears.perked, ''),
                tucked: resolveSkinAsset(skinId, ears.tucked, ''),
            },
            eyes: {
                open: resolveSkinAsset(skinId, eyes.open, ''),
                blink: resolveSkinAsset(skinId, eyes.blink, ''),
                tired: resolveSkinAsset(skinId, eyes.tired, ''),
                happy: resolveSkinAsset(skinId, eyes.happy, ''),
                worried: resolveSkinAsset(skinId, eyes.worried, ''),
                sleep: resolveSkinAsset(skinId, eyes.sleep, ''),
                grumpy: resolveSkinAsset(skinId, eyes.grumpy, ''),
            },
            mouth: {
                neutral: resolveSkinAsset(skinId, mouth.neutral, ''),
                smile: resolveSkinAsset(skinId, mouth.smile, ''),
                frown: resolveSkinAsset(skinId, mouth.frown, ''),
                yawn: resolveSkinAsset(skinId, mouth.yawn, ''),
                open: resolveSkinAsset(skinId, mouth.open, ''),
            },
            features: {
                tail: features.tail === true,
                legs: features.legs === true,
                ears: features.ears === true,
                earsInFront: features.earsInFront === true,
            },
            pivots: {
                head: {
                    x: numberOr(headPivot.x, DEFAULT_SKIN.pivots.head.x),
                    y: numberOr(headPivot.y, DEFAULT_SKIN.pivots.head.y),
                },
                tail: {
                    x: numberOr(tailPivot.x, DEFAULT_SKIN.pivots.tail.x),
                    y: numberOr(tailPivot.y, DEFAULT_SKIN.pivots.tail.y),
                },
                arms: {
                    left: {
                        x: numberOr(leftPivot.x, DEFAULT_SKIN.pivots.arms.left.x),
                        y: numberOr(leftPivot.y, DEFAULT_SKIN.pivots.arms.left.y),
                    },
                    right: {
                        x: numberOr(rightPivot.x, DEFAULT_SKIN.pivots.arms.right.x),
                        y: numberOr(rightPivot.y, DEFAULT_SKIN.pivots.arms.right.y),
                    },
                },
            },
            hatOffset: numberOr(source.hatOffset, DEFAULT_SKIN.hatOffset),
            sounds: sounds,
        };
    }

    function applySkinData(data, skinId) {
        let config = buildSkinConfig(data, skinId);
        Object.keys(config).forEach((key) => {
            skinConfig[key] = config[key];
        });
        skinState.id = skinId;
    }

    let skinLoadToken = 0;

    function loadSkinById(skinId) {
        let id = normalizeSkinId(skinId);
        let token = skinLoadToken + 1;

        skinLoadToken = token;
        skinState.ready = false;
        skinState.failedSkin = '';
        if (!id || configuredSkins.indexOf(id) === -1) {
            skinState.failedSkin = id;
            return Promise.resolve(false);
        }

        if (!window.fetch) {
            skinState.failedSkin = id;
            return Promise.resolve(false);
        }

        return window.fetch(skinConfigPath(id))
            .then((response) => {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then((data) => {
                if (token !== skinLoadToken) {
                    return false;
                }
                let problem = validateSkinConfig(data);
                if (problem) {
                    throw new Error(problem);
                }
                applySkinData(data, id);
                skinState.ready = true;
                skinState.failedSkin = '';
                store.skin = id;
                persist();
                return true;
            })
            .catch((err) => {
                if (token !== skinLoadToken) {
                    return false;
                }
                skinState.ready = false;
                skinState.failedSkin = id;
                log.error('Unable to load Bongo Companion skin "' + id + '"', err);
                return false;
            });
    }

    const skinState = kiwi.Vue.observable({
        id: configuredSkins[0],
        ready: false,
        failedSkin: '',
    });
    const skinConfig = kiwi.Vue.observable(JSON.parse(JSON.stringify(DEFAULT_SKIN)));
    let SNACKS_CONFIG_PATH = 'static/plugins/bongo-cat/snacks.json';
    let SNACKS_DIR = 'static/plugins/bongo-cat/snacks/';
    let SAMPLE_GAIN = {
        eat: 0.85,
        drink: 1.4,
        laugh: 1.2,
        snore: 1.8,
        wow: 1.2,
        yawn: 1.1,
    };
    let MOOD_HAPPY_MIN = 75;
    let MOOD_CONTENT_MIN = 50;
    let MOOD_LOW_MIN = 35;
    let SLEEP_STEADY_MS = 60000;
    let SLEEP_TIRED_MS = 30000;
    let SLEEP_EXHAUSTED_MS = 10000;
    let TAP_THROTTLE_MS = 75;
    let PAW_DOWN_MS = 170;
    let CARE_TICK_MS = 10000;
    let HUNGER_DECAY_MS = 12 * 60 * 1000;
    let TIREDNESS_DECAY_MS = 10 * 60 * 1000;
    let MOOD_DECAY_MS = 18 * 60 * 1000;
    let MUSIC_EFFECT_MS = 10 * 60 * 1000;
    let MUSIC_EFFECT_CAP_MS = 30 * 60 * 1000;
    let OFFLINE_DECAY_CAP_MS = 8 * 60 * 60 * 1000;
    let SNACK_COOLDOWN_MS = 10 * 60 * 1000;
    let NAP_COOLDOWN_MS = 30 * 60 * 1000;
    let PET_COOLDOWN_MS = 60 * 1000;
    let NAP_DURATION_MS = 10000;
    let FOOD_RAIN_MS = 450;
    let DRINK_MS = 1300;
    let PET_SOUND_MS = 400;
    let MESSAGE_REACTION_MS = 10000;
    let HIGHLIGHT_REACTION_MS = 30000;
    let NOTICE_REACTION_MS = 20000;
    let WORRIED_REACTION_MS = 30000;
    let CONNECT_REACTION_MS = 10000;
    let LISTEN_DURATION_MS = 1400;
    let CELEBRATE_DURATION_MS = 2400;
    let WORRIED_DURATION_MS = 6000;
    let EVIL_DURATION_MS = 24000;
    let EVIL_COOLDOWN_MS = 60000;
    let EVIL_CHANCE = 1 / 36;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function uniqueImages(images) {
        let unique = [];
        images.forEach((image) => {
            if (image && unique.indexOf(image) === -1) {
                unique.push(image);
            }
        });
        return unique;
    }

    function numberOr(value, fallback) {
        let number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function normalizePosition(value) {
        if (value === 'top' || value === 'bottom' || value === 'auto') {
            return value;
        }
        return 'auto';
    }

    function normalizeSize(stored) {
        let value = stored && stored.size;
        if (value === 'auto' || value === 'normal' || value === 'larger') {
            return value;
        }
        return stored && stored.large === true ? 'larger' : 'auto';
    }

    function timestampOr(value, fallback) {
        let number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    function readStoredState(key) {
        try {
            let stored = JSON.parse(window.localStorage.getItem(key) || 'null');
            return stored && typeof stored === 'object' ? stored : null;
        } catch (err) {
            return null;
        }
    }

    function pad2(value) {
        return value < 10 ? '0' + value : String(value);
    }

    function dayKey(date) {
        return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    }

    function cleanupLegacyState() {
        try {
            let keys = [];
            for (let i = 0; i < window.localStorage.length; i += 1) {
                let key = window.localStorage.key(i);
                if (key && key.indexOf(LEGACY_STORAGE_PREFIX) === 0) {
                    keys.push(key);
                }
            }
            keys.forEach((key) => {
                window.localStorage.removeItem(key);
            });
        } catch (err) {
            // Ignore storage cleanup failures.
        }
    }

    function loadState() {
        let now = Date.now();
        cleanupLegacyState();
        let stored = readStoredState(STORAGE_KEY);

        if (!stored) {
            stored = {};
        }

        let name = typeof stored.name === 'string' ? stored.name.trim().slice(0, 20) : '';
        let lastCareAt = stored.lastCareAt && typeof stored.lastCareAt === 'object'
            ? stored.lastCareAt
            : {};
        let hatsUnlocked = Array.isArray(stored.hatsUnlocked)
            ? stored.hatsUnlocked.filter((id, index, list) => typeof id === 'string' && list.indexOf(id) === index)
            : [];
        let selectedHat = typeof stored.selectedHat === 'string'
            ? stored.selectedHat
            : '';
        let hatRollsUsed = Math.max(0, Math.floor(numberOr(stored.hatRollsUsed, 0)));

        return {
            name: name || DEFAULT_NAME,
            skin: normalizeSkinId(stored.skin) || DEFAULT_SKIN_ID,
            sound: typeof stored.sound === 'boolean' ? stored.sound : true,
            volume: clamp(numberOr(stored.volume, DEFAULT_VOLUME), 0, 1),
            size: normalizeSize(stored),
            position: normalizePosition(stored.position),
            hidden: typeof stored.hidden === 'boolean' ? stored.hidden : true,
            hunger: clamp(numberOr(stored.hunger, DEFAULT_HUNGER), MIN_HUNGER, 100),
            tiredness: clamp(
                numberOr(stored.tiredness, DEFAULT_TIREDNESS),
                MIN_TIREDNESS,
                100
            ),
            mood: clamp(numberOr(stored.mood, DEFAULT_MOOD), MIN_MOOD, 100),
            xp: Math.min(MAX_XP, Math.max(0, Math.floor(numberOr(stored.xp, 0)))),
            lastHungerAt: timestampOr(stored.lastHungerAt, now),
            lastTirednessAt: timestampOr(stored.lastTirednessAt, now),
            lastMoodAt: timestampOr(stored.lastMoodAt, now),
            lastActiveXpAt: timestampOr(stored.lastActiveXpAt, now),
            lastVibeXpAt: timestampOr(stored.lastVibeXpAt, now),
            activeXpDay: typeof stored.activeXpDay === 'string'
                ? stored.activeXpDay
                : dayKey(new Date(now)),
            activeXpToday: Math.min(
                ACTIVE_XP_DAILY_CAP,
                Math.max(0, Math.floor(numberOr(stored.activeXpToday, 0)))
            ),
            lastXpDay: typeof stored.lastXpDay === 'string'
                ? stored.lastXpDay
                : dayKey(new Date(now)),
            hatsUnlocked: hatsUnlocked,
            selectedHat: selectedHat,
            hatRollsUsed: hatRollsUsed,
            lastCareAt: {
                snack: timestampOr(lastCareAt.snack, 0),
                nap: timestampOr(lastCareAt.nap, 0),
                pet: timestampOr(lastCareAt.pet, 0),
            },
        };
    }

    const store = kiwi.Vue.observable(loadState());

    function resetCareClocks(now) {
        let time = typeof now === 'number' ? now : Date.now();
        store.lastHungerAt = time;
        store.lastTirednessAt = time;
        store.lastMoodAt = time;
        store.lastActiveXpAt = time;
        store.lastVibeXpAt = time;
    }

    function addXp(amount) {
        let before = store.xp;
        store.xp = Math.min(MAX_XP, before + amount);
        return store.xp - before;
    }

    function persist() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                name: store.name,
                skin: store.skin,
                sound: store.sound,
                volume: store.volume,
                size: store.size,
                position: store.position,
                hidden: store.hidden,
                hunger: store.hunger,
                tiredness: store.tiredness,
                mood: store.mood,
                xp: store.xp,
                lastHungerAt: store.lastHungerAt,
                lastTirednessAt: store.lastTirednessAt,
                lastMoodAt: store.lastMoodAt,
                lastActiveXpAt: store.lastActiveXpAt,
                lastVibeXpAt: store.lastVibeXpAt,
                activeXpDay: store.activeXpDay,
                activeXpToday: store.activeXpToday,
                lastXpDay: store.lastXpDay,
                hatsUnlocked: store.hatsUnlocked,
                selectedHat: store.selectedHat,
                hatRollsUsed: store.hatRollsUsed,
                lastCareAt: {
                    snack: store.lastCareAt.snack,
                    nap: store.lastCareAt.nap,
                    pet: store.lastCareAt.pet,
                },
            }));
        } catch (err) {
            log.error('Unable to save Bongo Companion state', err);
        }
    }

    if (configuredSkins.indexOf(store.skin) === -1) {
        store.skin = configuredSkins[0];
        persist();
    }
    skinState.id = store.skin;

    let audioContext = null;

    function getAudioContext() {
        if (audioContext) {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            return audioContext;
        }

        let AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            return null;
        }

        try {
            audioContext = new AudioContext();
        } catch (err) {
            return null;
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        return audioContext;
    }

    function playTone(high) {
        if (!store.sound || store.volume <= 0) {
            return;
        }

        let ctx = getAudioContext();
        if (!ctx) {
            return;
        }

        let now = ctx.currentTime;
        let oscillator = ctx.createOscillator();
        let gain = ctx.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(high ? 190 : 145, now);
        oscillator.frequency.exponentialRampToValueAtTime(75, now + 0.09);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.18 * store.volume), now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.13);
    }

    let sampleBuffers = {};
    let sampleLoading = {};

    function loadSample(name) {
        if (!skinConfig.sounds[name]) {
            return Promise.resolve(null);
        }
        if (sampleBuffers[name]) {
            return Promise.resolve(sampleBuffers[name]);
        }
        if (sampleLoading[name]) {
            return sampleLoading[name];
        }

        let ctx = getAudioContext();
        if (!ctx || !window.fetch) {
            return Promise.resolve(null);
        }

        sampleLoading[name] = window.fetch(skinConfig.sounds[name])
            .then((response) => {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.arrayBuffer();
            })
            .then((data) => ctx.decodeAudioData(data))
            .then((buffer) => {
                sampleBuffers[name] = buffer;
                sampleLoading[name] = null;
                return buffer;
            })
            .catch((err) => {
                sampleLoading[name] = null;
                log.error('Unable to load Bongo Companion sound', err);
                return null;
            });

        return sampleLoading[name];
    }

    function playSample(name) {
        if (!store.sound || store.volume <= 0 || store.hidden) {
            return;
        }

        let ctx = getAudioContext();
        if (!ctx) {
            return;
        }

        loadSample(name).then((buffer) => {
            if (!buffer || !store.sound || store.volume <= 0 || store.hidden) {
                return;
            }

            let source = ctx.createBufferSource();
            let gain = ctx.createGain();
            source.buffer = buffer;
            source.loop = false;
            gain.gain.value = store.volume * (SAMPLE_GAIN[name] || 1);
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start(0);
        });
    }

    let BongoCat = kiwi.Vue.extend({
        template: '#kiwi-bongo-cat',
        props: {
            network: {
                type: Object,
                default: null,
            },
            buffer: {
                type: Object,
                default: null,
            },
            pluginProps: {
                type: Object,
                default: null,
            },
        },
        data: function() {
            return {
                cardOpen: false,
                sleeping: false,
                napping: false,
                napUntil: 0,
                typing: false,
                pawSide: 'left',
                pawDownSide: '',
                leftHandIdle: 1,
                rightHandIdle: 2,
                legsIdle: 1,
                petted: false,
                feeding: null,
                feedingBitten: false,
                snackOptions: [],
                blinking: false,
                yawning: false,
                smiling: false,
                evil: false,
                evilCooldownUntil: 0,
                listening: false,
                celebrating: false,
                worried: false,
                acknowledging: false,
                lastActivityAt: Date.now(),
                lastSoundAt: 0,
                lastPetSoundAt: 0,
                lastMusicAt: Date.now(),
                lastConnectReactionAt: 0,
                lastMessageReactionAt: 0,
                lastHighlightReactionAt: 0,
                lastNoticeReactionAt: 0,
                lastWorriedReactionAt: 0,
                lastUserActivityAt: 0,
                highTone: false,
                now: Date.now(),
                toolbarOpen: false,
                toolbarLift: 0,
                toolbarObserver: null,
                previousResolvedPosition: null,
                positionAnimationStart: 0,
                positionAnimationPending: false,
                positionAnimation: null,
                toolbarCheckTimer: null,
                typingTimer: null,
                sleepTimer: null,
                pettedTimer: null,
                feedingTimer: null,
                feedingSwapTimer: null,
                pawDownTimer: null,
                leftHandTimer: null,
                rightHandTimer: null,
                legsTimer: null,
                listeningTimer: null,
                celebratingTimer: null,
                worriedTimer: null,
                acknowledgeTimer: null,
                blinkTimer: null,
                blinkLoopTimer: null,
                yawnTimer: null,
                yawnLoopTimer: null,
                smileTimer: null,
                smileLoopTimer: null,
                evilTimer: null,
            };
        },
        computed: {
            tailImage: function() {
                if (!skinConfig.features.tail) {
                    return '';
                }

                let tail = skinConfig.tail;
                let image = '';
                if (this.asleep) {
                    image = tail.tucked;
                } else if (this.moodBand === 'grumpy' || this.worried) {
                    image = tail.grumpy;
                } else if (this.moodBand === 'happy' || this.listening ||
                    this.celebrating || this.petted) {
                    image = tail.happy;
                } else if (this.tirednessBand === 'tired' ||
                    this.tirednessBand === 'exhausted' ||
                    this.moodBand === 'low') {
                    image = tail.tired;
                }
                return image || tail.normal || '';
            },
            showTail: function() {
                return skinConfig.features.tail && !!this.tailImage;
            },
            tailPivot: function() {
                let pivot = skinConfig.pivots.tail;
                return pivot.x + 'px ' + pivot.y + 'px';
            },
            showLegs: function() {
                return skinConfig.features.legs;
            },
            showEars: function() {
                return skinConfig.features.ears;
            },
            earsInFront: function() {
                return skinConfig.features.earsInFront;
            },
            hatY: function() {
                return -15 + skinConfig.hatOffset;
            },
            headPivot: function() {
                let pivot = skinConfig.pivots.head;
                return pivot.x + 'px ' + pivot.y + 'px';
            },
            leftArmPivot: function() {
                let pivot = skinConfig.pivots.arms.left;
                return pivot.x + 'px ' + pivot.y + 'px';
            },
            rightArmPivot: function() {
                let pivot = skinConfig.pivots.arms.right;
                return pivot.x + 'px ' + pivot.y + 'px';
            },
            store: function() {
                return store;
            },
            activeViewOpen: function() {
                return !!(kiwi.state && kiwi.state.ui &&
                    kiwi.state.ui.active_view_open);
            },
            sidebarOpen: function() {
                return !!(kiwi.state && kiwi.state.ui &&
                    kiwi.state.ui.sidebar_open);
            },
            nicklistOpen: function() {
                return !!(kiwi.state && kiwi.state.ui &&
                    kiwi.state.ui.sidebar_open &&
                    kiwi.state.ui.sidebar_section === 'nicklist' &&
                    !this.activeViewOpen);
            },
            resolvedPosition: function() {
                if (store.position === 'auto') {
                    return (this.activeViewOpen || this.sidebarOpen) ? 'bottom' : 'top';
                }
                return normalizePosition(store.position);
            },
            isLarge: function() {
                return store.size === 'larger' ||
                    (store.size === 'auto' && this.nicklistOpen);
            },
            placementStyle: function() {
                let insets = kiwi.layout && kiwi.layout.insets ?
                    kiwi.layout.insets :
                    {};
                let right = BASE_RIGHT_OFFSET + Math.max(0, numberOr(insets.right, 0));
                if (this.resolvedPosition === 'top') {
                    return {
                        right: right + 'px',
                        top: (BASE_TOP_OFFSET + Math.max(0, numberOr(insets.top, 0))) + 'px',
                    };
                }
                let bottom = BASE_BOTTOM_OFFSET + Math.max(
                    0,
                    numberOr(this.toolbarLift, 0)
                );
                return {
                    right: right + 'px',
                    bottom: (bottom + Math.max(0, numberOr(insets.bottom, 0))) + 'px',
                };
            },
            skinReady: function() {
                return skinState.ready;
            },
            skinError: function() {
                return skinState.failedSkin;
            },
            level: function() {
                return Math.min(MAX_LEVEL, Math.floor(store.xp / XP_PER_LEVEL) + 1);
            },
            levelProgress: function() {
                return store.xp >= MAX_XP ? XP_PER_LEVEL : store.xp % XP_PER_LEVEL;
            },
            levelPercent: function() {
                return Math.round((this.levelProgress / XP_PER_LEVEL) * 100);
            },
            xpPerLevel: function() {
                return XP_PER_LEVEL;
            },
            showHat: function() {
                return !!(store.selectedHat &&
                    hatCatalog.map[store.selectedHat] &&
                    store.hatsUnlocked.indexOf(store.selectedHat) !== -1);
            },
            hatImage: function() {
                let hat = hatCatalog.map[store.selectedHat];
                return hat ? hat.file : '';
            },
            baseEyeImage: function() {
                if (this.asleep) {
                    return skinConfig.eyes.sleep;
                }
                if (this.worried) {
                    return skinConfig.eyes.worried;
                }
                if (this.evilMode) {
                    return skinConfig.eyes.grumpy;
                }
                if (this.moodBand === 'grumpy') {
                    return skinConfig.eyes.grumpy;
                }
                if (this.tirednessBand === 'tired' || this.tirednessBand === 'exhausted') {
                    return skinConfig.eyes.tired;
                }
                if (this.moodBand === 'happy') {
                    return skinConfig.eyes.happy;
                }
                return skinConfig.eyes.open;
            },
            eyeImage: function() {
                if (this.asleep) {
                    return skinConfig.eyes.sleep;
                }
                if (this.acknowledging) {
                    return skinConfig.eyes.blink;
                }
                if (this.blinking) {
                    return this.baseEyeImage === skinConfig.eyes.happy
                        ? skinConfig.eyes.open
                        : skinConfig.eyes.blink;
                }
                return this.baseEyeImage;
            },
            skinBodyImage: function() {
                return skinConfig.body;
            },
            skinHeadImage: function() {
                return skinConfig.head;
            },
            earImage: function() {
                if (this.moodBand === 'grumpy' || this.worried) {
                    return skinConfig.ears.tucked;
                }
                if (this.listening || this.celebrating || this.petted) {
                    return skinConfig.ears.perked;
                }
                return skinConfig.ears.neutral;
            },
            leftHandDown: function() {
                return this.asleep || this.pawDownSide === 'left';
            },
            rightHandDown: function() {
                return this.asleep || this.pawDownSide === 'right';
            },
            leftHandImage: function() {
                if (this.leftHandDown) {
                    return skinConfig.hands.left.down;
                }
                return this.leftHandIdle === 1
                    ? skinConfig.hands.left.up1
                    : skinConfig.hands.left.up2;
            },
            rightHandImage: function() {
                if (this.rightHandDown) {
                    return skinConfig.hands.right.down;
                }
                return this.rightHandIdle === 1
                    ? skinConfig.hands.right.up1
                    : skinConfig.hands.right.up2;
            },
            legsImage: function() {
                if (this.asleep) {
                    return skinConfig.legs.sleep;
                }
                return this.legsIdle === 1
                    ? skinConfig.legs.idle1
                    : skinConfig.legs.idle2;
            },
            mouthImage: function() {
                if (this.asleep) {
                    return this.moodBand === 'grumpy'
                        ? skinConfig.mouth.frown
                        : skinConfig.mouth.neutral;
                }
                if (this.evilMode) {
                    return skinConfig.mouth.smile;
                }
                if (this.yawning) {
                    return skinConfig.mouth.yawn;
                }
                if (this.celebrating) {
                    return skinConfig.mouth.open;
                }
                if (this.petted) {
                    return this.moodBand === 'happy' || this.smiling
                        ? skinConfig.mouth.open
                        : skinConfig.mouth.smile;
                }
                if (this.moodBand === 'grumpy' || this.worried) {
                    return skinConfig.mouth.frown;
                }
                if (this.smiling) {
                    return skinConfig.mouth.smile;
                }
                return skinConfig.mouth.neutral;
            },
            eyeVariants: function() {
                return uniqueImages([
                    skinConfig.eyes.open,
                    skinConfig.eyes.blink,
                    skinConfig.eyes.happy,
                    this.eyeImage,
                ]);
            },
            mouthVariants: function() {
                return uniqueImages([
                    skinConfig.mouth.neutral,
                    skinConfig.mouth.smile,
                    skinConfig.mouth.open,
                    this.mouthImage,
                ]);
            },
            earVariants: function() {
                return uniqueImages([
                    skinConfig.ears.neutral,
                    skinConfig.ears.perked,
                    this.earImage,
                ]);
            },
            leftHandVariants: function() {
                return uniqueImages([
                    skinConfig.hands.left.up1,
                    skinConfig.hands.left.up2,
                    skinConfig.hands.left.down,
                ]);
            },
            rightHandVariants: function() {
                return uniqueImages([
                    skinConfig.hands.right.up1,
                    skinConfig.hands.right.up2,
                    skinConfig.hands.right.down,
                ]);
            },
            legsVariants: function() {
                return uniqueImages([
                    skinConfig.legs.idle1,
                    skinConfig.legs.idle2,
                    this.legsImage,
                ]);
            },
            radioPlaying: function() {
                return !!(kiwi.media && kiwi.media.playing);
            },
            hungerBand: function() {
                if (store.hunger >= 75) {
                    return 'starving';
                }
                if (store.hunger >= 50) {
                    return 'hungry';
                }
                if (store.hunger >= 25) {
                    return 'okay';
                }
                return 'full';
            },
            tirednessBand: function() {
                if (store.tiredness >= 75) {
                    return 'exhausted';
                }
                if (store.tiredness >= 50) {
                    return 'tired';
                }
                if (store.tiredness >= 25) {
                    return 'okay';
                }
                return 'rested';
            },
            moodDecayMultiplier: function() {
                let multiplier = 1;
                if (store.hunger >= 50) {
                    multiplier += 0.25;
                }
                if (store.tiredness >= 50) {
                    multiplier += 0.25;
                }
                if (store.hunger >= 75) {
                    multiplier += 0.25;
                }
                if (store.tiredness >= 75) {
                    multiplier += 0.25;
                }
                return Math.min(2, multiplier);
            },
            moodBand: function() {
                if (store.mood < MOOD_LOW_MIN) {
                    return 'grumpy';
                }
                if (store.mood < MOOD_CONTENT_MIN) {
                    return 'low';
                }
                if (store.mood >= MOOD_HAPPY_MIN) {
                    return 'happy';
                }
                return 'content';
            },
            evilMode: function() {
                return this.evil &&
                    this.moodBand === 'happy' &&
                    !store.hidden &&
                    !this.asleep &&
                    !this.worried &&
                    !this.celebrating &&
                    !this.petted &&
                    !this.listening &&
                    !this.yawning &&
                    !this.acknowledging;
            },
            radioMode: function() {
                if (!this.radioPlaying) {
                    return 'none';
                }
                if (this.asleep || this.tirednessBand === 'exhausted') {
                    return 'sleep';
                }
                if (this.typing || this.celebrating || this.worried || this.listening) {
                    return 'none';
                }
                if (this.moodBand === 'grumpy') {
                    return 'none';
                }
                if (this.moodBand === 'low') {
                    return 'listen';
                }
                if (this.tirednessBand === 'tired') {
                    return 'tired-jam';
                }
                return 'jam';
            },
            dancing: function() {
                return this.celebrating ||
                    this.radioMode === 'jam' ||
                    this.radioMode === 'tired-jam';
            },
            showMusicNotes: function() {
                return this.radioMode === 'jam' || this.radioMode === 'tired-jam';
            },
            asleep: function() {
                return this.sleeping || this.napping;
            },
            sleepThreshold: function() {
                switch (this.tirednessBand) {
                case 'exhausted':
                    return SLEEP_EXHAUSTED_MS;
                case 'tired':
                    return SLEEP_TIRED_MS;
                case 'okay':
                    return SLEEP_STEADY_MS;
                default:
                    return Infinity;
                }
            },
            snackRemaining: function() {
                return this.cooldownRemaining(store.lastCareAt.snack, SNACK_COOLDOWN_MS);
            },
            napRemaining: function() {
                return this.cooldownRemaining(store.lastCareAt.nap, NAP_COOLDOWN_MS);
            },
            snackTitle: function() {
                if (store.hunger < 10) {
                    return this.$t('bongo-cat:not_hungry', { name: store.name });
                }
                return this.snackRemaining > 0
                    ? this.$t('bongo-cat:snack_ready_in', {
                        time: this.cooldownLabel(this.snackRemaining),
                    })
                    : this.$t('bongo-cat:give_snack', { name: store.name });
            },
            napTitle: function() {
                if (store.tiredness < 10) {
                    return this.$t('bongo-cat:not_tired', { name: store.name });
                }
                return this.napRemaining > 0
                    ? this.$t('bongo-cat:nap_ready_in', {
                        time: this.cooldownLabel(this.napRemaining),
                    })
                    : this.$t('bongo-cat:let_nap', { name: store.name });
            },
        },
        watch: {
            'dancing': function() {
                this.rescheduleLimbSwaps();
            },
            'evilMode': function(active) {
                if (!active && this.evil) {
                    this.endEvil();
                }
            },
            'store.hidden': function(hidden) {
                resetCareClocks(Date.now());
                this.lastMusicAt = Date.now();
                this.lastActivityAt = Date.now();
                if (!hidden) {
                    this.wake();
                }
            },
            'network.state': function(state) {
                this.onNetworkStateChanged(state);
            },
        },
        mounted: function() {
            kiwi.on('input.activity', this.onActivity, this);
            kiwi.on('message.new', this.onMessage, this);
            kiwi.on('twitch.usernotice', this.onUserNotice, this);
            this.applyDecay();
            store.lastActiveXpAt = Date.now();
            store.lastVibeXpAt = Date.now();
            this.applyProgression();
            this.checkSleep();
            this.scheduleBlink();
            this.ensureYawnScheduled();
            this.ensureSmileScheduled();
            this.scheduleHandSwap('left');
            this.scheduleHandSwap('right');
            this.scheduleLegSwap();
            this.loadSnacks();
            this.loadHats();
            this.loadSkin();
            this.observeToolbar();
            this.updateToolbarOffset();
            this.previousResolvedPosition = this.resolvedPosition;
            window.addEventListener('resize', this.scheduleToolbarCheck);
            document.addEventListener('click', this.onDocumentClick, true);
            this.sleepTimer = window.setInterval(this.tick.bind(this), CARE_TICK_MS);
        },
        beforeUpdate: function() {
            if (this.previousResolvedPosition !== null &&
                this.resolvedPosition !== this.previousResolvedPosition &&
                this.$el &&
                typeof this.$el.getBoundingClientRect === 'function'
            ) {
                this.positionAnimationStart = this.$el.getBoundingClientRect().top;
                this.positionAnimationPending = true;
            }
        },
        updated: function() {
            if (this.positionAnimationPending) {
                this.positionAnimationPending = false;
                this.animatePositionChange(this.positionAnimationStart);
            }
            this.previousResolvedPosition = this.resolvedPosition;
        },
        beforeDestroy: function() {
            kiwi.off('input.activity', this.onActivity, this);
            kiwi.off('message.new', this.onMessage, this);
            kiwi.off('twitch.usernotice', this.onUserNotice, this);
            window.removeEventListener('resize', this.scheduleToolbarCheck);
            document.removeEventListener('click', this.onDocumentClick, true);
            if (this.positionAnimation) {
                this.positionAnimation.cancel();
                this.positionAnimation = null;
            }
            if (this.toolbarObserver) {
                this.toolbarObserver.disconnect();
                this.toolbarObserver = null;
            }
            window.clearTimeout(this.toolbarCheckTimer);
            window.clearInterval(this.sleepTimer);
            window.clearTimeout(this.typingTimer);
            window.clearTimeout(this.pettedTimer);
            window.clearTimeout(this.feedingTimer);
            window.clearTimeout(this.feedingSwapTimer);
            window.clearTimeout(this.pawDownTimer);
            window.clearTimeout(this.leftHandTimer);
            window.clearTimeout(this.rightHandTimer);
            window.clearTimeout(this.legsTimer);
            window.clearTimeout(this.listeningTimer);
            window.clearTimeout(this.celebratingTimer);
            window.clearTimeout(this.worriedTimer);
            window.clearTimeout(this.acknowledgeTimer);
            window.clearTimeout(this.blinkTimer);
            window.clearTimeout(this.blinkLoopTimer);
            window.clearTimeout(this.yawnTimer);
            window.clearTimeout(this.yawnLoopTimer);
            window.clearTimeout(this.smileTimer);
            window.clearTimeout(this.smileLoopTimer);
            window.clearTimeout(this.evilTimer);
        },
        methods: {
            isToolbarOpen: function() {
                let inline = document.querySelector('.kiwi-controlinput--show-tools--inline');
                let tools = document.querySelector('.kiwi-controlinput-tools-container');
                let active = document.querySelector('.kiwi-controlinput-active-tool');
                return (!!tools && !inline) || !!(active && active.firstElementChild);
            },
            measureToolbarLift: function() {
                let input = document.querySelector('.kiwi-controlinput');
                if (!input) {
                    return 0;
                }

                let inputTop = input.getBoundingClientRect().top;
                let toolbarRects = [];
                let tools = document.querySelector('.kiwi-controlinput-tools-container');
                if (tools) {
                    toolbarRects.push(tools.getBoundingClientRect());
                }

                let active = document.querySelector('.kiwi-controlinput-active-tool');
                if (active) {
                    Array.from(active.children).forEach((child) => {
                        toolbarRects.push(child.getBoundingClientRect());
                    });
                }

                let tops = toolbarRects
                    .filter((rect) => rect.height > 0)
                    .map((rect) => rect.top);
                if (!tops.length) {
                    return 0;
                }

                return Math.max(0, inputTop - Math.min(...tops));
            },
            updateToolbarOffset: function() {
                this.toolbarOpen = this.isToolbarOpen();
                this.toolbarLift = this.toolbarOpen ? this.measureToolbarLift() : 0;
            },
            scheduleToolbarCheck: function() {
                if (this.toolbarCheckTimer) {
                    return;
                }
                this.toolbarCheckTimer = window.setTimeout(() => {
                    this.toolbarCheckTimer = null;
                    this.updateToolbarOffset();
                }, 0);
            },
            animatePositionChange: function(startTop) {
                if (!this.$el ||
                    typeof this.$el.animate !== 'function' ||
                    !this.$el.getBoundingClientRect ||
                    (window.matchMedia &&
                        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                ) {
                    return;
                }

                let endTop = this.$el.getBoundingClientRect().top;
                let delta = startTop - endTop;
                if (!delta) {
                    return;
                }

                if (this.positionAnimation) {
                    this.positionAnimation.cancel();
                }
                this.positionAnimation = this.$el.animate(
                    [
                        { transform: 'translateY(' + delta + 'px)' },
                        { transform: 'translateY(0)' },
                    ],
                    {
                        duration: 220,
                        easing: 'ease-out',
                    }
                );
                this.positionAnimation.onfinish = () => {
                    this.positionAnimation = null;
                };
            },
            isToolbarMutationRelevant: function(mutations) {
                let selector = '.kiwi-controlinput-tools-container, ' +
                    '.kiwi-controlinput-active-tool';
                let isRelevantNode = function(node) {
                    return !!(node && node.nodeType === 1 &&
                        (node.matches(selector) || node.querySelector(selector)));
                };

                for (let i = 0; i < mutations.length; i += 1) {
                    let target = mutations[i].target;
                    if (target && target.nodeType === 1 && target.closest(selector)) {
                        return true;
                    }

                    let added = mutations[i].addedNodes;
                    for (let j = 0; j < added.length; j += 1) {
                        if (isRelevantNode(added[j])) {
                            return true;
                        }
                    }

                    let removed = mutations[i].removedNodes;
                    for (let k = 0; k < removed.length; k += 1) {
                        if (isRelevantNode(removed[k])) {
                            return true;
                        }
                    }
                }
                return false;
            },
            onToolbarMutation: function(mutations) {
                if (this.isToolbarMutationRelevant(mutations)) {
                    this.scheduleToolbarCheck();
                }
            },
            observeToolbar: function() {
                if (this.toolbarObserver || typeof window.MutationObserver !== 'function') {
                    return;
                }
                this.toolbarObserver = new window.MutationObserver(
                    this.onToolbarMutation.bind(this)
                );
                this.toolbarObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                });
            },
            cooldownRemaining: function(lastAt, duration) {
                let remaining = (lastAt || 0) + duration - this.now;
                return remaining > 0 ? remaining : 0;
            },
            cooldownLabel: function(remaining) {
                return this.$t('bongo-cat:cooldown_minutes', {
                    minutes: Math.max(1, Math.ceil(remaining / 60000)),
                });
            },
            tick: function() {
                this.now = Date.now();
                this.applyDecay();
                this.applyMusicEffects();
                this.applyProgression();

                if (this.napping && this.now >= this.napUntil) {
                    this.napping = false;
                    this.napUntil = 0;
                    this.lastActivityAt = this.now;
                }

                this.checkSleep();
                if (this.evil && !this.evilMode) {
                    this.endEvil();
                }
                this.ensureYawnScheduled();
                this.ensureSmileScheduled();
            },
            applyDecay: function() {
                let now = Date.now();
                if (store.hidden) {
                    resetCareClocks(now);
                    return;
                }

                let lastHunger = Math.min(timestampOr(store.lastHungerAt, now), now);
                let lastTiredness = Math.min(timestampOr(store.lastTirednessAt, now), now);
                let lastMood = Math.min(timestampOr(store.lastMoodAt, now), now);
                let hungerElapsed = Math.min(
                    Math.max(now - lastHunger, 0),
                    OFFLINE_DECAY_CAP_MS
                );
                let tirednessElapsed = Math.min(
                    Math.max(now - lastTiredness, 0),
                    OFFLINE_DECAY_CAP_MS
                );
                let moodElapsed = Math.min(
                    Math.max(now - lastMood, 0),
                    OFFLINE_DECAY_CAP_MS
                );
                let hungerGain = Math.floor(hungerElapsed / HUNGER_DECAY_MS);
                let tirednessGain = this.asleep
                    ? 0
                    : Math.floor(tirednessElapsed / TIREDNESS_DECAY_MS);
                let multiplier = this.moodDecayMultiplier;
                let moodLoss = Math.floor((moodElapsed * multiplier) / MOOD_DECAY_MS);

                if (this.asleep) {
                    store.lastTirednessAt = now;
                }

                if (hungerGain === 0 && tirednessGain === 0 && moodLoss === 0) {
                    return;
                }

                store.hunger = clamp(store.hunger + hungerGain, MIN_HUNGER, 100);
                if (!this.asleep) {
                    store.tiredness = clamp(
                        store.tiredness + tirednessGain,
                        MIN_TIREDNESS,
                        100
                    );
                    store.lastTirednessAt = now - (tirednessElapsed % TIREDNESS_DECAY_MS);
                }
                store.mood = clamp(store.mood - moodLoss, MIN_MOOD, 100);
                store.lastHungerAt = now - (hungerElapsed % HUNGER_DECAY_MS);
                store.lastMoodAt = now - Math.floor(
                    ((moodElapsed * multiplier) % MOOD_DECAY_MS) / multiplier
                );
                persist();
            },
            applyMusicEffects: function() {
                let now = Date.now();
                if (store.hidden || this.asleep || !this.radioPlaying) {
                    this.lastMusicAt = now;
                    return;
                }

                let last = Math.min(timestampOr(this.lastMusicAt, now), now);
                let elapsed = Math.min(Math.max(now - last, 0), MUSIC_EFFECT_CAP_MS);
                let points = Math.floor(elapsed / MUSIC_EFFECT_MS);

                if (points === 0) {
                    return;
                }

                store.mood = clamp(store.mood + points, MIN_MOOD, 100);
                store.tiredness = clamp(
                    store.tiredness + points,
                    MIN_TIREDNESS,
                    100
                );
                this.lastMusicAt = now - (elapsed % MUSIC_EFFECT_MS);
                persist();
            },
            isVibing: function() {
                return !this.asleep &&
                    this.radioPlaying &&
                    (this.radioMode === 'jam' || this.radioMode === 'tired-jam');
            },
            applyProgression: function() {
                let now = Date.now();
                let today = dayKey(new Date(now));
                let changed = false;

                if (store.lastXpDay !== today) {
                    store.lastXpDay = today;
                    addXp(DAILY_XP);
                    changed = true;
                }

                if (store.activeXpDay !== today) {
                    store.activeXpDay = today;
                    store.activeXpToday = 0;
                    changed = true;
                }

                if (store.hidden || document.visibilityState === 'hidden') {
                    store.lastActiveXpAt = now;
                    store.lastVibeXpAt = now;
                    if (changed) {
                        persist();
                    }
                    return;
                }

                let activeAwarded = false;
                let last = Math.min(timestampOr(store.lastActiveXpAt, now), now);
                let elapsed = Math.min(Math.max(now - last, 0), ACTIVE_XP_CAP_MS);
                let points = Math.floor(elapsed / ACTIVE_XP_MS);
                let hasActivity = this.lastUserActivityAt >= last;

                if (points > 0) {
                    let activeCapLeft = ACTIVE_XP_DAILY_CAP - store.activeXpToday;
                    if (hasActivity && activeCapLeft > 0) {
                        let activeAmount = Math.min(
                            points * ACTIVE_XP_POINTS,
                            activeCapLeft
                        );
                        let activeGained = addXp(activeAmount);
                        if (activeGained > 0) {
                            store.activeXpToday += activeGained;
                            activeAwarded = true;
                            changed = true;
                        }
                    }
                    store.lastActiveXpAt = now - (elapsed % ACTIVE_XP_MS);
                } else if (!hasActivity) {
                    store.lastActiveXpAt = now;
                }

                let vibing = this.isVibing();
                let vibeLast = Math.min(timestampOr(store.lastVibeXpAt, now), now);
                let vibeElapsed = Math.min(Math.max(now - vibeLast, 0), VIBE_XP_CAP_MS);
                let vibePoints = Math.floor(vibeElapsed / VIBE_XP_MS);

                if (vibePoints > 0) {
                    let vibeCapLeft = ACTIVE_XP_DAILY_CAP - store.activeXpToday;
                    if (!activeAwarded && vibing && vibeCapLeft > 0) {
                        let vibeGained = addXp(
                            Math.min(vibePoints * VIBE_XP_POINTS, vibeCapLeft)
                        );
                        if (vibeGained > 0) {
                            store.activeXpToday += vibeGained;
                            changed = true;
                        }
                    }
                    store.lastVibeXpAt = now - (vibeElapsed % VIBE_XP_MS);
                } else if (activeAwarded || !vibing) {
                    store.lastVibeXpAt = now;
                }

                if (changed) {
                    persist();
                }
            },
            showHeart: function(duration) {
                this.petted = true;
                window.clearTimeout(this.pettedTimer);
                this.pettedTimer = window.setTimeout(() => {
                    this.petted = false;
                }, duration);
            },
            listen: function(duration) {
                this.listening = true;
                window.clearTimeout(this.listeningTimer);
                this.listeningTimer = window.setTimeout(() => {
                    this.listening = false;
                }, duration);
            },
            celebrate: function(duration) {
                this.wake();
                this.listening = false;
                this.worried = false;
                this.celebrating = true;
                this.playSound('wow');
                this.showHeart(900);
                window.clearTimeout(this.celebratingTimer);
                this.celebratingTimer = window.setTimeout(() => {
                    this.celebrating = false;
                }, duration);
            },
            worry: function(duration) {
                this.worried = true;
                window.clearTimeout(this.worriedTimer);
                this.worriedTimer = window.setTimeout(() => {
                    this.worried = false;
                }, duration);
            },
            acknowledge: function() {
                this.acknowledging = true;
                window.clearTimeout(this.acknowledgeTimer);
                this.acknowledgeTimer = window.setTimeout(() => {
                    this.acknowledging = false;
                }, 1000);
            },
            shouldBlink: function() {
                if (window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    return false;
                }
                return true;
            },
            scheduleBlink: function() {
                window.clearTimeout(this.blinkLoopTimer);
                if (!this.shouldBlink()) {
                    return;
                }

                let delay = 4000 + Math.floor(Math.random() * 4000);
                this.blinkLoopTimer = window.setTimeout(() => {
                    if (this.asleep || !this.shouldBlink()) {
                        this.scheduleBlink();
                        return;
                    }

                    this.blinking = true;
                    window.clearTimeout(this.blinkTimer);
                    this.blinkTimer = window.setTimeout(() => {
                        this.blinking = false;
                        this.scheduleBlink();
                    }, 140);
                }, delay);
            },
            shouldYawn: function() {
                if (store.hidden || this.asleep ||
                    this.worried || this.celebrating) {
                    return false;
                }
                if (window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    return false;
                }
                return this.tirednessBand === 'tired' || this.tirednessBand === 'exhausted';
            },
            ensureYawnScheduled: function() {
                if (this.yawnLoopTimer || this.yawnTimer || !this.shouldYawn()) {
                    return;
                }
                this.scheduleYawn();
            },
            scheduleYawn: function() {
                window.clearTimeout(this.yawnLoopTimer);
                this.yawnLoopTimer = null;
                if (!this.shouldYawn()) {
                    return;
                }

                let delay = 20000 + Math.floor(Math.random() * 20000);
                this.yawnLoopTimer = window.setTimeout(() => {
                    this.yawnLoopTimer = null;
                    if (!this.shouldYawn()) {
                        this.ensureYawnScheduled();
                        return;
                    }

                    this.yawning = true;
                    this.playSound('yawn');
                    window.clearTimeout(this.yawnTimer);
                    this.yawnTimer = window.setTimeout(() => {
                        this.yawnTimer = null;
                        this.yawning = false;
                        this.ensureYawnScheduled();
                    }, 1200);
                }, delay);
            },
            canEnterEvil: function() {
                return this.shouldSmile() &&
                    !this.petted &&
                    !this.listening &&
                    !this.acknowledging &&
                    Date.now() >= this.evilCooldownUntil;
            },
            startEvil: function() {
                if (!this.canEnterEvil()) {
                    return false;
                }

                window.clearTimeout(this.smileTimer);
                this.smileTimer = null;
                window.clearTimeout(this.smileLoopTimer);
                this.smileLoopTimer = null;
                this.smiling = false;
                this.evil = true;
                window.clearTimeout(this.evilTimer);
                this.evilTimer = window.setTimeout(() => {
                    this.evilTimer = null;
                    this.endEvil();
                }, EVIL_DURATION_MS);
                return true;
            },
            endEvil: function() {
                if (!this.evil) {
                    return;
                }

                this.evil = false;
                window.clearTimeout(this.evilTimer);
                this.evilTimer = null;
                this.evilCooldownUntil = Date.now() + EVIL_COOLDOWN_MS;
                this.ensureSmileScheduled();
            },
            shouldSmile: function() {
                if (store.hidden || this.asleep || this.evil ||
                    this.worried || this.celebrating || this.yawning) {
                    return false;
                }
                if (this.shouldYawn()) {
                    return false;
                }
                if (window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    return false;
                }
                return this.moodBand === 'happy';
            },
            ensureSmileScheduled: function() {
                if (this.smileLoopTimer || this.smileTimer || !this.shouldSmile()) {
                    return;
                }
                this.scheduleSmile();
            },
            scheduleSmile: function() {
                window.clearTimeout(this.smileLoopTimer);
                this.smileLoopTimer = null;
                if (!this.shouldSmile()) {
                    return;
                }

                let delay = 8000 + Math.floor(Math.random() * 8000);
                this.smileLoopTimer = window.setTimeout(() => {
                    this.smileLoopTimer = null;
                    if (!this.shouldSmile()) {
                        this.ensureSmileScheduled();
                        return;
                    }

                    if (this.canEnterEvil() &&
                        Math.random() < EVIL_CHANCE &&
                        this.startEvil()) {
                        return;
                    }

                    this.smiling = true;
                    window.clearTimeout(this.smileTimer);
                    this.smileTimer = window.setTimeout(() => {
                        this.smileTimer = null;
                        this.smiling = false;
                        this.ensureSmileScheduled();
                    }, 1500);
                }, delay);
            },
            shouldSwapLimbs: function() {
                if (store.hidden || this.asleep) {
                    return false;
                }
                return !(window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            },
            limbSwapDelay: function() {
                if (this.dancing) {
                    return 400 + Math.floor(Math.random() * 600);
                }
                return 2000 + Math.floor(Math.random() * 3000);
            },
            rescheduleLimbSwaps: function() {
                this.scheduleHandSwap('left');
                this.scheduleHandSwap('right');
                this.scheduleLegSwap();
            },
            scheduleHandSwap: function(side) {
                let timerKey = side === 'left' ? 'leftHandTimer' : 'rightHandTimer';
                window.clearTimeout(this[timerKey]);
                this[timerKey] = window.setTimeout(() => {
                    this[timerKey] = null;
                    if (this.shouldSwapLimbs() && this.pawDownSide !== side) {
                        if (side === 'left') {
                            this.leftHandIdle = this.leftHandIdle === 1 ? 2 : 1;
                        } else {
                            this.rightHandIdle = this.rightHandIdle === 1 ? 2 : 1;
                        }
                    }
                    this.scheduleHandSwap(side);
                }, this.limbSwapDelay());
            },
            scheduleLegSwap: function() {
                window.clearTimeout(this.legsTimer);
                this.legsTimer = window.setTimeout(() => {
                    this.legsTimer = null;
                    if (this.shouldSwapLimbs()) {
                        this.legsIdle = this.legsIdle === 1 ? 2 : 1;
                    }
                    this.scheduleLegSwap();
                }, this.limbSwapDelay());
            },
            onMessage: function(event) {
                if (store.hidden || !event || !event.message || !event.buffer) {
                    return;
                }
                if (event.buffer !== this.buffer) {
                    return;
                }

                let message = event.message;
                if (!message.is_new || message.ignore) {
                    return;
                }
                if (message.nick && this.network && message.nick === this.network.nick) {
                    return;
                }
                if (message.type !== 'privmsg' && message.type !== 'action') {
                    return;
                }

                let now = Date.now();
                if (message.isHighlight) {
                    if (now - this.lastHighlightReactionAt < HIGHLIGHT_REACTION_MS) {
                        return;
                    }

                    this.lastHighlightReactionAt = now;
                    if (this.moodBand === 'grumpy') {
                        this.wake();
                        this.acknowledge();
                        return;
                    }

                    this.celebrate(CELEBRATE_DURATION_MS);
                    store.mood = clamp(store.mood + 2, MIN_MOOD, 100);
                    persist();
                    return;
                }

                if (now - this.lastMessageReactionAt < MESSAGE_REACTION_MS) {
                    return;
                }

                this.lastMessageReactionAt = now;
                this.wake();
                this.listen(LISTEN_DURATION_MS);
            },
            onUserNotice: function(event) {
                if (store.hidden || !event || !event.buffer || event.buffer !== this.buffer) {
                    return;
                }

                let now = Date.now();
                if (now - this.lastNoticeReactionAt < NOTICE_REACTION_MS) {
                    return;
                }

                this.lastNoticeReactionAt = now;
                this.celebrate(CELEBRATE_DURATION_MS);
                store.mood = clamp(store.mood + 1, MIN_MOOD, 100);
                persist();
            },
            onNetworkStateChanged: function(state) {
                if (store.hidden || !this.network) {
                    return;
                }

                let now = Date.now();
                if (state === 'disconnected') {
                    if (now - this.lastWorriedReactionAt < WORRIED_REACTION_MS) {
                        return;
                    }

                    this.lastWorriedReactionAt = now;
                    this.worry(WORRIED_DURATION_MS);
                    return;
                }

                if (state === 'connected') {
                    if (now - this.lastConnectReactionAt < CONNECT_REACTION_MS) {
                        return;
                    }

                    this.lastConnectReactionAt = now;
                    this.celebrate(1600);
                }
            },
            wake: function() {
                let now = Date.now();
                let wasAsleep = this.sleeping || this.napping;
                this.lastActivityAt = now;
                if (wasAsleep) {
                    store.lastTirednessAt = now;
                    persist();
                }
                this.sleeping = false;
                this.worried = false;
                if (this.napping) {
                    this.napping = false;
                    this.napUntil = 0;
                }
            },
            checkSleep: function() {
                if (store.hidden || this.asleep) {
                    return;
                }

                if (this.radioPlaying && this.tirednessBand !== 'exhausted') {
                    this.lastActivityAt = Date.now();
                    this.sleeping = false;
                    return;
                }

                if (Date.now() - this.lastActivityAt > this.sleepThreshold) {
                    this.sleeping = true;
                    store.lastTirednessAt = Date.now();
                    persist();
                    if (this.tirednessBand === 'exhausted') {
                        this.playSound('snore');
                    }
                }
            },
            onActivity: function() {
                if (store.hidden) {
                    return;
                }

                this.lastUserActivityAt = Date.now();
                this.wake();
                this.pawSide = this.pawSide === 'left' ? 'right' : 'left';
                this.pawDownSide = this.pawSide;
                this.typing = true;

                window.clearTimeout(this.pawDownTimer);
                this.pawDownTimer = window.setTimeout(() => {
                    this.pawDownSide = '';
                }, PAW_DOWN_MS);

                window.clearTimeout(this.typingTimer);
                this.typingTimer = window.setTimeout(() => {
                    this.typing = false;
                }, 520);

                if (store.sound && Date.now() - this.lastSoundAt > TAP_THROTTLE_MS) {
                    this.lastSoundAt = Date.now();
                    this.highTone = !this.highTone;
                    playTone(this.highTone);
                }
            },
            toggleCard: function() {
                this.wake();
                this.now = Date.now();
                this.cardOpen = !this.cardOpen;
            },
            onDocumentClick: function(event) {
                if (!this.cardOpen || !event || !event.target) {
                    return;
                }
                if (this.$el && this.$el.contains(event.target)) {
                    return;
                }
                this.cardOpen = false;
            },
            openSettings: function() {
                this.cardOpen = false;
                if (!AppSettings) {
                    return;
                }

                kiwi.state.$emit('active.component', AppSettings);
                window.setTimeout(() => {
                    kiwi.state.$emit('settings.tab.show', SETTINGS_TAB_NAME);
                }, 0);
            },
            pet: function() {
                this.wake();
                this.now = Date.now();
                this.showHeart(900);

                if (!this.lastPetSoundAt || this.now - this.lastPetSoundAt >= PET_SOUND_MS) {
                    this.lastPetSoundAt = this.now;
                    this.playSound('laugh');
                }

                if (this.cooldownRemaining(store.lastCareAt.pet, PET_COOLDOWN_MS) === 0) {
                    let moodGain = store.hunger >= 75 || store.tiredness >= 75 ? 3 : 6;
                    store.mood = clamp(store.mood + moodGain, MIN_MOOD, 100);
                    store.lastCareAt.pet = Date.now();
                    persist();
                }
            },
            normalizeSkinConfig: function(data) {
                return buildSkinConfig(
                    data,
                    skinState.id || store.skin || configuredSkins[0]
                );
            },
            applySkinConfig: function(data) {
                applySkinData(
                    data,
                    skinState.id || store.skin || configuredSkins[0]
                );
            },
            loadSkin: function() {
                return loadSkinById(store.skin);
            },
            normalizeHatConfig: function(data) {
                let list = data && Array.isArray(data.hats) ? data.hats : [];
                let seen = Object.create(null);
                let options = [];

                list.forEach((item) => {
                    if (!item || typeof item !== 'object') {
                        return;
                    }
                    if (typeof item.id !== 'string' || !item.id || seen[item.id]) {
                        return;
                    }
                    if (typeof item.name !== 'string' || !item.name) {
                        return;
                    }
                    if (typeof item.file !== 'string' || !item.file) {
                        return;
                    }

                    seen[item.id] = true;
                    options.push({
                        id: item.id,
                        name: item.name,
                        file: HATS_DIR + item.file,
                    });
                });

                return options;
            },
            applyHatCatalog: function(options) {
                let map = Object.create(null);
                options.forEach((hat) => {
                    map[hat.id] = hat;
                });
                hatCatalog.options = options;
                hatCatalog.map = map;

                let unlocked = store.hatsUnlocked.filter((id) => !!map[id]);
                let selected = map[store.selectedHat] &&
                    unlocked.indexOf(store.selectedHat) !== -1
                    ? store.selectedHat
                    : '';

                if (unlocked.length !== store.hatsUnlocked.length ||
                    selected !== store.selectedHat) {
                    store.hatsUnlocked = unlocked;
                    store.selectedHat = selected;
                    persist();
                }
            },
            loadHats: function() {
                if (!window.fetch) {
                    this.applyHatCatalog([]);
                    return;
                }

                window.fetch(HATS_CONFIG_PATH)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error('HTTP ' + response.status);
                        }
                        return response.json();
                    })
                    .then((data) => {
                        this.applyHatCatalog(this.normalizeHatConfig(data));
                    })
                    .catch((err) => {
                        this.applyHatCatalog([]);
                        log.error('Unable to load Bongo Companion hats', err);
                    });
            },
            normalizeSnackConfig: function(data) {
                let list = data && Array.isArray(data.snacks) ? data.snacks : [];
                let seen = Object.create(null);
                let options = [];

                list.forEach((item) => {
                    if (!item || typeof item !== 'object') {
                        return;
                    }
                    if (typeof item.id !== 'string' || !item.id || seen[item.id]) {
                        return;
                    }
                    if (typeof item.name !== 'string' || !item.name) {
                        return;
                    }
                    if (typeof item.image !== 'string' || !item.image) {
                        return;
                    }
                    if (item.type !== 'food' && item.type !== 'drink') {
                        return;
                    }
                    if (item.render !== 'overlay' && item.render !== 'rain') {
                        return;
                    }

                    let bitten = typeof item.bitten === 'string' && item.bitten
                        ? SNACKS_DIR + item.bitten
                        : '';
                    seen[item.id] = true;
                    options.push({
                        id: item.id,
                        name: item.name,
                        type: item.type,
                        render: item.render,
                        image: SNACKS_DIR + item.image,
                        bittenImage: bitten,
                    });
                });

                return options;
            },
            loadSnacks: function() {
                if (!window.fetch) {
                    return;
                }

                window.fetch(SNACKS_CONFIG_PATH)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error('HTTP ' + response.status);
                        }
                        return response.json();
                    })
                    .then((data) => {
                        this.snackOptions = this.normalizeSnackConfig(data);
                    })
                    .catch((err) => {
                        this.snackOptions = [];
                        log.error('Unable to load Bongo Companion snacks', err);
                    });
            },
            pickSnack: function() {
                if (!this.snackOptions.length) {
                    return null;
                }
                return this.snackOptions[
                    Math.floor(Math.random() * this.snackOptions.length)
                ];
            },
            snack: function() {
                if (this.snackRemaining > 0 || store.hunger < 10) {
                    return;
                }

                this.wake();
                this.now = Date.now();

                let snack = this.pickSnack();
                let food = snack ? snack.type !== 'drink' : true;
                store.hunger = clamp(
                    store.hunger - (food ? 30 : 20),
                    MIN_HUNGER,
                    100
                );
                store.tiredness = clamp(
                    store.tiredness + (food ? 2 : -5),
                    MIN_TIREDNESS,
                    100
                );
                store.mood = clamp(store.mood + (food ? 4 : 2), MIN_MOOD, 100);
                store.lastCareAt.snack = this.now;

                this.feeding = snack;
                this.feedingBitten = false;
                this.playSound(food ? 'eat' : 'drink');
                window.clearTimeout(this.feedingTimer);
                window.clearTimeout(this.feedingSwapTimer);

                if (snack) {
                    if (snack.render === 'rain') {
                        this.feedingTimer = window.setTimeout(() => {
                            this.feeding = null;
                        }, FOOD_RAIN_MS);
                    } else {
                        if (snack.bittenImage) {
                            this.feedingSwapTimer = window.setTimeout(() => {
                                this.feedingBitten = true;
                            }, DRINK_MS / 2);
                        }
                        this.feedingTimer = window.setTimeout(() => {
                            this.feeding = null;
                            this.feedingBitten = false;
                        }, DRINK_MS);
                    }
                }

                persist();
            },
            nap: function() {
                if (this.napRemaining > 0 || store.tiredness < 10) {
                    return;
                }

                this.lastActivityAt = Date.now();
                this.sleeping = false;
                this.napping = true;
                this.napUntil = this.lastActivityAt + NAP_DURATION_MS;
                this.now = this.lastActivityAt;
                let rest = store.hunger >= 75 ? 20 : 35;
                store.tiredness = clamp(store.tiredness - rest, MIN_TIREDNESS, 100);
                store.lastTirednessAt = this.now;
                store.mood = clamp(store.mood + 8, MIN_MOOD, 100);
                store.lastCareAt.nap = this.now;
                this.playSound('snore');
                persist();
            },
            playSound: function(name) {
                playSample(name);
            },
            toggleSound: function() {
                store.sound = !store.sound;
                persist();
                if (store.sound) {
                    playTone(true);
                }
            },
            toggleSize: function() {
                if (store.size === 'larger') {
                    store.size = 'normal';
                } else if (store.size === 'normal') {
                    store.size = 'larger';
                }
                persist();
            },
            togglePosition: function() {
                store.position = store.position === 'top' ? 'bottom' : 'top';
                persist();
            },
        },
    });

    let SettingsPanel = kiwi.Vue.extend({
        template: '#kiwi-bongo-cat-settings',
        data: function() {
            return {
                draftName: store.name,
                hatRollResult: null,
                hatRollTimer: null,
            };
        },
        computed: {
            store: function() {
                return store;
            },
            skinOptions: function() {
                return configuredSkins;
            },
            skinError: function() {
                return skinState.failedSkin;
            },
            level: function() {
                return Math.min(MAX_LEVEL, Math.floor(store.xp / XP_PER_LEVEL) + 1);
            },
            levelProgress: function() {
                return store.xp >= MAX_XP ? XP_PER_LEVEL : store.xp % XP_PER_LEVEL;
            },
            xpPerLevel: function() {
                return XP_PER_LEVEL;
            },
            hatOptions: function() {
                return hatCatalog.options.filter(
                    (hat) => store.hatsUnlocked.indexOf(hat.id) !== -1,
                );
            },
            hatRollsRemaining: function() {
                return Math.max(0, this.level - store.hatRollsUsed);
            },
            hatsUnlockedCount: function() {
                return store.hatsUnlocked.length;
            },
            hatCount: function() {
                return hatCatalog.options.length;
            },
        },
        watch: {
            'store.name': function(name) {
                this.draftName = name;
            },
        },
        beforeDestroy: function() {
            window.clearTimeout(this.hatRollTimer);
        },
        methods: {
            saveName: function() {
                let name = (this.draftName || '').trim().slice(0, 20);
                if (!name) {
                    name = DEFAULT_NAME;
                }

                store.name = name;
                this.draftName = name;
                persist();
            },
            toggleSound: function() {
                store.sound = !store.sound;
                persist();
                if (store.sound) {
                    playTone(true);
                }
            },
            saveVolume: function() {
                store.volume = clamp(numberOr(store.volume, DEFAULT_VOLUME), 0, 1);
                persist();
                playTone(true);
            },
            setSize: function(value) {
                if (value === 'auto' || value === 'normal' || value === 'larger') {
                    store.size = value;
                    persist();
                }
            },
            setPosition: function(value) {
                store.position = normalizePosition(value);
                persist();
            },
            show: function() {
                resetCareClocks(Date.now());
                store.hidden = false;
                persist();
            },
            hide: function() {
                resetCareClocks(Date.now());
                store.hidden = true;
                persist();
            },
            selectSkin: function(value) {
                if (configuredSkins.indexOf(value) === -1) {
                    return;
                }
                store.skin = value;
                persist();
                loadSkinById(value);
            },
            selectHat: function(value) {
                if (value !== '' && store.hatsUnlocked.indexOf(value) === -1) {
                    return;
                }
                store.selectedHat = value;
                persist();
            },
            rollHat: function() {
                if (this.hatRollsRemaining <= 0 || !hatCatalog.options.length) {
                    return;
                }

                let hat = hatCatalog.options[
                    Math.floor(Math.random() * hatCatalog.options.length)
                ];
                let isNew = store.hatsUnlocked.indexOf(hat.id) === -1;
                store.hatRollsUsed += 1;

                if (isNew) {
                    store.hatsUnlocked.push(hat.id);
                    if (!store.selectedHat) {
                        store.selectedHat = hat.id;
                    }
                    this.hatRollResult = {
                        type: 'new',
                        name: hat.name,
                        file: hat.file,
                    };
                } else {
                    addXp(5);
                    this.hatRollResult = {
                        type: 'duplicate',
                        name: hat.name,
                        file: hat.file,
                    };
                }

                persist();
                window.clearTimeout(this.hatRollTimer);
                this.hatRollTimer = window.setTimeout(() => {
                    this.hatRollResult = null;
                }, 4000);
            },
            reset: function() {
                if (!window.confirm(this.$t('bongo-cat:reset_confirm'))) {
                    return;
                }

                let now = Date.now();
                store.hunger = DEFAULT_HUNGER;
                store.tiredness = DEFAULT_TIREDNESS;
                store.mood = DEFAULT_MOOD;
                store.xp = 0;
                store.lastHungerAt = now;
                store.lastTirednessAt = now;
                store.lastMoodAt = now;
                store.lastActiveXpAt = now;
                store.lastVibeXpAt = now;
                store.activeXpDay = dayKey(new Date(now));
                store.activeXpToday = 0;
                store.lastXpDay = dayKey(new Date(now));
                store.hatsUnlocked = [];
                store.selectedHat = '';
                store.hatRollsUsed = 0;
                store.lastCareAt.snack = 0;
                store.lastCareAt.nap = 0;
                store.lastCareAt.pet = 0;
                this.draftName = store.name;
                persist();
            },
        },
    });

    kiwi.addUi('app', BongoCat);
    kiwi.addTab('settings', SETTINGS_TAB_NAME, SettingsPanel);
});
