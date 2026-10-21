<template>
    <div
        class="kiwi-messagelist-message kiwi-twitch-usernotice"
        :class="[
            `kiwi-messagelist-message-${message.type}`,
            `kiwi-twitch-usernotice--${noticeType.key}`,
            highlighted ? 'kiwi-messagelist-message--highlight' : '',
            playEntrance ? 'kiwi-twitch-usernotice--fresh' : '',
        ]"
        :style="{ '--kiwi-twitch-usernotice-accent': noticeType.accent }"
        :data-message-id="message.id"
        :data-nick="(message.nick || '').toLowerCase()"
        @click="ml.onMessageClick($event, message, true)"
        @auxclick="ml.onMessageAuxClick($event)"
        @dblclick="ml.onMessageDblClick($event, message)"
    >
        <div class="kiwi-twitch-usernotice-icon" aria-hidden="true">
            <i class="fa" :class="noticeType.icon" />
        </div>
        <div class="kiwi-twitch-usernotice-main">
            <div class="kiwi-twitch-usernotice-head">
                <span class="kiwi-twitch-usernotice-kind">{{ $t(noticeType.labelKey) }}</span>
                <span
                    v-if="showTimestamp"
                    class="kiwi-twitch-usernotice-time"
                    :title="ml.formatTimeFull(message.time)"
                >{{ ml.formatTime(message.time) }}</span>
            </div>
            <div class="kiwi-twitch-usernotice-title">
                <UserAvatar
                    v-if="message.user"
                    class="kiwi-twitch-usernotice-avatar"
                    :data-nick="(message.nick || '').toLowerCase()"
                    :user="message.user"
                    :network="network"
                    :message="message"
                />
                <span
                    class="kiwi-twitch-usernotice-headline"
                    :data-nick="(message.nick || '').toLowerCase()"
                >
                    <span
                        v-for="(part, index) in headlineParts"
                        :key="`headline-${index}`"
                        :class="{ 'kiwi-formatting-reverse kiwi-twitch-usernotice-actor': part.actor }"
                    >{{ part.text }}</span>
                </span>
            </div>
            <div v-if="details.length" class="kiwi-twitch-usernotice-details">
                <span
                    v-for="detail in details"
                    :key="`${detail.labelKey}-${detail.value || detail.valueKey}`"
                    class="kiwi-twitch-usernotice-detail"
                >
                    <span class="kiwi-twitch-usernotice-detail-label">
                        {{ $t(detail.labelKey) }}
                    </span>
                    <span class="kiwi-twitch-usernotice-detail-value">
                        {{ detailValue(detail) }}
                    </span>
                </span>
            </div>
            <div
                v-if="bodyHtml"
                class="kiwi-twitch-usernotice-body"
                v-html="bodyHtml"
            />
        </div>
    </div>
</template>

<script>
'kiwi public';

import UserAvatar from './UserAvatar';
import {
    twitchUserNoticeType,
    twitchUserNoticeDetails
} from '@/helpers/Twitch';

const noticedEntrance = new WeakSet();
const ENTRANCE_MAX_AGE = 20000;

export default {
    name: 'TwitchUserNotice',
    components: {
        UserAvatar,
    },
    props: {
        buffer: {
            type: Object,
            required: true,
        },
        message: {
            type: Object,
            required: true,
        },
        idx: {
            type: Number,
            default: 0,
        },
        ml: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            playEntrance: false,
        };
    },
    computed: {
        tags() {
            return this.message.tags || {};
        },
        noticeType() {
            return twitchUserNoticeType(this.tags['msg-id']);
        },
        details() {
            return twitchUserNoticeDetails(this.tags, this.tags['msg-id']);
        },
        network() {
            return this.buffer.getNetwork();
        },
        headlineParts() {
            const headline = this.tags['system-msg'] || '';
            const actor = this.tags['display-name'] || this.tags.login || this.message.nick || '';

            if (!headline) {
                return [{
                    text: actor || this.$t(this.noticeType.labelKey),
                    actor: !!actor,
                }];
            }

            if (!actor) {
                return [{ text: headline, actor: false }];
            }

            const actorIndex = headline.toLowerCase().indexOf(actor.toLowerCase());
            if (actorIndex === -1) {
                return [
                    { text: actor, actor: true },
                    { text: ` ${headline}`, actor: false },
                ];
            }

            const parts = [];
            if (actorIndex > 0) {
                parts.push({
                    text: headline.slice(0, actorIndex),
                    actor: false,
                });
            }
            parts.push({
                text: headline.slice(actorIndex, actorIndex + actor.length),
                actor: true,
            });

            const actorEnd = actorIndex + actor.length;
            if (actorEnd < headline.length) {
                parts.push({
                    text: headline.slice(actorEnd),
                    actor: false,
                });
            }

            return parts;
        },
        bodyHtml() {
            return this.message.message ?
                this.ml.formatMessage(this.message) :
                '';
        },
        showTimestamp() {
            return !!this.ml.bufferSetting('show_timestamps');
        },
        highlighted() {
            return this.ml.isMessageHighlight(this.message);
        },
    },
    created() {
        if (!this.message.is_new || noticedEntrance.has(this.message)) {
            return;
        }

        const messageTime = new Date(this.message.time).getTime();
        const age = Date.now() - messageTime;
        if (age >= 0 && age < ENTRANCE_MAX_AGE) {
            noticedEntrance.add(this.message);
            this.playEntrance = true;
        }
    },
    methods: {
        detailValue(detail) {
            if (detail.valueKey) {
                return this.$t(detail.valueKey, detail.valueParams || {});
            }
            return detail.value;
        },
    },
};
</script>

<style>
.kiwi-twitch-usernotice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 6px 8px;
    padding: 10px 12px;
    border: 1px solid rgb(127 127 127 / 0.25);
    border-left: 4px solid var(--kiwi-twitch-usernotice-accent, #8b5cf6);
    border-radius: 6px;
    background: rgb(127 127 127 / 0.08);
    color: inherit;
    overflow-wrap: anywhere;
}

.kiwi-twitch-usernotice--fresh {
    animation: kiwi-twitch-usernotice-in 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.kiwi-twitch-usernotice--fresh .kiwi-twitch-usernotice-icon {
    animation: kiwi-twitch-usernotice-icon-in 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes kiwi-twitch-usernotice-in {
    0% {
        opacity: 0;
        transform: translateY(6px) scale(0.97);
    }

    45% {
        opacity: 1;
        transform: translateY(0) scale(1.01) rotate(-0.5deg);
    }

    62% {
        transform: rotate(0.4deg);
    }

    78% {
        transform: rotate(-0.2deg);
    }

    100% {
        opacity: 1;
        transform: none;
    }
}

@keyframes kiwi-twitch-usernotice-icon-in {
    0% {
        transform: scale(0.6) rotate(-12deg);
    }

    55% {
        transform: scale(1.12) rotate(6deg);
    }

    80% {
        transform: scale(0.98);
    }

    100% {
        transform: none;
    }
}

.kiwi-twitch-usernotice-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 30px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgb(127 127 127 / 0.14);
    color: var(--kiwi-twitch-usernotice-accent, #8b5cf6);
    font-size: 15px;
}

.kiwi-twitch-usernotice-main {
    flex: 1 1 auto;
    min-width: 0;
}

.kiwi-twitch-usernotice-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 4px;
}

.kiwi-twitch-usernotice-kind {
    color: var(--kiwi-twitch-usernotice-accent, #8b5cf6);
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.kiwi-twitch-usernotice-time {
    flex: 0 0 auto;
    opacity: 0.6;
    font-size: 11px;
}

.kiwi-twitch-usernotice-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-weight: bold;
    line-height: 1.4;
}

.kiwi-twitch-usernotice-avatar {
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
}

.kiwi-twitch-usernotice-headline {
    min-width: 0;
}

.kiwi-twitch-usernotice-details {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}

.kiwi-twitch-usernotice-detail {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    padding: 2px 7px;
    border-radius: 10px;
    background: rgb(127 127 127 / 0.14);
    font-size: 11px;
    line-height: 1.6;
}

.kiwi-twitch-usernotice-detail-label {
    opacity: 0.65;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.kiwi-twitch-usernotice-detail-value {
    font-weight: bold;
}

.kiwi-twitch-usernotice-body {
    margin-top: 8px;
    padding-left: 10px;
    border-left: 2px solid rgb(127 127 127 / 0.3);
    line-height: 1.45;
    opacity: 0.9;
}

.kiwi-twitch-usernotice-body > :first-child {
    margin-top: 0;
}

.kiwi-twitch-usernotice-body > :last-child {
    margin-bottom: 0;
}

@media (width <= 480px) {
    .kiwi-twitch-usernotice {
        gap: 8px;
        margin: 5px 4px;
        padding: 8px 9px;
    }

    .kiwi-twitch-usernotice-icon {
        flex-basis: 26px;
        width: 26px;
        height: 26px;
        font-size: 13px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .kiwi-twitch-usernotice--fresh,
    .kiwi-twitch-usernotice--fresh .kiwi-twitch-usernotice-icon {
        animation: none;
    }
}
</style>
