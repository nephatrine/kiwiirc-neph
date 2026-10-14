<template>
    <div class="kiwi-aboutbuffer">
        <div v-if="buffer.avatarUrl()" class="kiwi-aboutbuffer-avatar">
            <img :src="buffer.avatarUrl(256)" alt="">
        </div>
        <div class="kiwi-aboutbuffer-header">
            <div class="kiwi-aboutbuffer-displayname">
                {{ b.metadata['display-name'] || b.name }}
            </div>
            <div v-if="b.metadata['display-name']" class="kiwi-aboutbuffer-name">
                {{ b.name }}
            </div>
        </div>

        <div
            :class="{ 'kiwi-aboutbuffer-section--closed': closedSections.about }"
            class="kiwi-aboutbuffer-section"
        >
            <h4 :title="$t('toggle_section')" @click="toggleSection('about')">
                <i class="fa fa-angle-right" /> {{ $t('about') }}
            </h4>
            <div>
                <div v-if="hasMetadata && b.metadata.description" class="kiwi-aboutbuffer-branding">
                    <div class="kiwi-aboutbuffer-description" v-html="formattedDescription" />
                </div>

                <div v-if="b.topic || !b.metadata.description" class="kiwi-aboutbuffer-topic-wrap">
                    <template v-if="b.topic">
                        <div class="kiwi-aboutbuffer-topic" v-html="formattedTopic" />
                        <p v-if="b.topic_by && b.topic_when" class="kiwi-aboutbuffer-topic-setby">
                            {{
                                $t('topic_setby', {
                                    who: b.topic_by,
                                    when: new Intl.DateTimeFormat().format(b.topic_when),
                                })
                            }}
                        </p>
                    </template>
                    <p v-else>{{ $t('no_topic_set') }}</p>
                </div>

                <p v-if="b.created_at" class="kiwi-aboutbuffer-created">
                    {{ $t('created_on', { when: new Intl.DateTimeFormat().format(b.created_at) }) }}
                </p>

                <p class="kiwi-aboutbuffer-usercount">
                    <a class="u-link " @click="sidebarState.showNicklist()">
                        {{ $t(Object.keys(b.users || {}).length === 1 ? 'person' : 'person_plural', { count: Object.keys(b.users || {}).length }) }}
                    </a>
                </p>
            </div>
        </div>

        <div
            :class="{ 'kiwi-aboutbuffer-section--closed': closedSections.highlights }"
            class="kiwi-aboutbuffer-section"
        >
            <h4 :title="$t('toggle_section')" @click="toggleSection('highlights')">
                <i class="fa fa-angle-right" /> {{ $t('highlights') }}
            </h4>
            <div>
                <ul v-if="highlights.length > 0">
                    <li
                        v-for="msg in highlights"
                        :key="msg.id"
                        class="kiwi-aboutbuffer-highlight"
                        @click="buffer.scrollToMessage(msg.id)"
                    >
                        {{ msg.nick ? `${msg.nick}: ` : '' }}<span v-html="msg.html" />
                    </li>
                </ul>
                <p v-else>{{ $t('nobody_mentioned_you') }}</p>
            </div>
        </div>

        <div
            v-if="areWeAnOp"
            :class="{ 'kiwi-aboutbuffer-section--closed': closedSections.invite }"
            class="kiwi-aboutbuffer-section"
        >
            <h4 :title="$t('toggle_section')" @click="toggleSection('invite')">
                <i class="fa fa-angle-right" /> {{ $t('invite_user') }}
            </h4>
            <div>
                <div class="kiwi-aboutbuffer-invite u-form">
                    <input
                        v-model="inviteNick"
                        type="text"
                        class="u-input"
                        @keydown="inviteKeyDown"
                    >
                    <a class="u-button u-button-secondary" @click="inviteUser">
                        {{ $t('invite_user') }}
                    </a>
                </div>
                <auto-complete
                    v-if="invitableUsers.length > 0"
                    ref="autocomplete"
                    class="kiwi-aboutbuffer-invite-auto-complete"
                    items-per-page="5"
                    :items="invitableUsers"
                    :filter="inviteNick"
                    @selected="inviteSelected"
                />
            </div>
        </div>

        <div
            v-for="plugin in pluginUiSections"
            :key="plugin.id"
            :class="{ 'kiwi-aboutbuffer-section--closed': closedSections[plugin.id] }"
            class="kiwi-aboutbuffer-section"
        >
            <h4 :title="$t('toggle_section')" @click="toggleSection(plugin.id)">
                <i class="fa fa-angle-right" /> {{ plugin.title() }}
            </h4>
            <component
                :is="plugin.component"
                :plugin-props="{
                    buffer,
                    aboutbuffer: self,
                }"
                v-bind="plugin.props"
                :network="network"
                :buffer="buffer"
                :sidebar-state="sidebarState"
            />
        </div>
    </div>
</template>

<script>
'kiwi public';

import GlobalApi from '@/libs/GlobalApi';
import toHtml from '@/libs/renderers/Html';
import parseMessage from '@/libs/MessageParser';
import AutoComplete from './AutoComplete';

export default {
    components: {
        AutoComplete,
    },
    props: ['network', 'buffer', 'sidebarState'],
    data() {
        return {
            self: this,
            pluginUiSections: GlobalApi.singleton().aboutBufferPlugins,
            closedSections: {},
            inviteNick: '',
        };
    },
    computed: {
        b() {
            return this.buffer || {};
        },
        formattedTopic() {
            let blocks = parseMessage(this.b.topic || '', { extras: false });
            let content = toHtml(blocks, false);
            return content;
        },
        formattedDescription() {
            let blocks = parseMessage(this.b.metadata.description || '', { extras: false });
            let content = toHtml(blocks, false);
            return content;
        },
        highlights() {
            // Tap into buffer.message_count to force vuejs to update this function when
            // it changes
            /* eslint-disable no-unused-vars */
            let tmp = this.buffer.message_count;
            return this.buffer.getMessages()
                .filter((m) => {
                    const isIgnored = m.user ? m.user.ignore : m.ignore;
                    return m.isHighlight && !isIgnored;
                })
                .filter((m) => m.type !== 'traffic')
                .filter((m) => m.type !== 'topic')
                .filter((m) => m.type !== 'mode')
                .filter((m) => m.html)
                .sort((a, b) => b.time - a.time);
        },
        areWeAnOp() {
            return this.buffer.isUserAnOp(this.network.nick);
        },
        hasMetadata() {
            return this.network && this.network.metadataCap();
        },
        invitableUsers() {
            const wantedBuffer = (userBuffer) => userBuffer.buffer.name === this.buffer.name;
            return Object.values(this.network.users)
                .filter((user) => !Object.values(user.buffers).find(wantedBuffer))
                .map((user) => ({ text: user.nick }));
        },
    },
    created() {
        const now = Date.now();
        const cooldown = 30 * 60 * 1000;
        const isOld = now - (this.buffer.lastMetadataFetch || 0) > cooldown;
        const isService = this.buffer.isQuery() && this.network.isService(this.buffer.name);

        const canFetch = this.hasMetadata && (this.buffer.joined || this.buffer.isQuery());

        if (isOld && !isService && canFetch) {
            this.network.getMetadata(this.buffer.name, [
                'description',
                'display-name',
                'avatar',
            ]);
        }
    },
    methods: {
        toggleSection(section) {
            this.$set(this.closedSections, section, !this.closedSections[section]);
        },
        inviteUser() {
            if (!this.inviteNick) {
                return;
            }
            this.network.ircClient.invite(this.buffer.name, this.inviteNick);
            this.inviteNick = '';
        },
        inviteSelected(value, item) {
            this.inviteNick = value;
        },
        inviteKeyDown(event) {
            if (event.key === 'Tab') {
                this.$refs.autocomplete.selectCurrentItem();
                return;
            }
            this.$refs.autocomplete.handleOnKeyDown(event);
        },
    },
};
</script>

<style lang="less">
/* Adjust the sidebars width when this component is in view */
.kiwi-sidebar.kiwi-sidebar-section-about {
    max-width: 400px;
    width: 400px;
}

.kiwi-aboutbuffer {
    overflow-y: auto;
    box-sizing: border-box;
    min-height: 100px;
    margin: auto;
    width: 100%;
    //Padding bottom is needed, otherwise the scrollbar will show on the right side.
    padding-bottom: 1px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.kiwi-aboutbuffer-avatar {
    width: 100%;
    text-align: center;
    padding: 20px 0;
    background: rgba(128, 128, 128, 0.05);

    img {
        max-width: 150px;
        max-height: 150px;
        border-radius: 8px;
        object-fit: contain;
    }
}

.kiwi-aboutbuffer-header {
    padding: 10px 20px;
    width: 100%;
    box-sizing: border-box;
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
    margin-bottom: 10px;

    .kiwi-aboutbuffer-displayname {
        font-size: 1.6em;
        font-weight: bold;
        word-break: break-all;
    }

    .kiwi-aboutbuffer-name {
        font-size: 0.9em;
        opacity: 0.6;
    }
}

.kiwi-aboutbuffer-section {
    display: block;
    width: 100%;

    h4 {
        padding: 10px 20px;
        cursor: pointer;
        user-select: none;
        text-transform: uppercase;
        font-size: 0.9em;
        letter-spacing: 1px;
        font-weight: bold;
    }

    h4 i {
        margin-right: 5px;
        transition: transform 0.2s;
    }

    &--closed h4 i {
        transform: rotate(90deg);
    }

    > div {
        padding: 10px 20px 20px 20px;
        transition: max-height 0.2s, padding 0.2s, opacity 0.2s;
        overflow: hidden;
    }

    &--closed > div {
        max-height: 0;
        padding: 0;
        opacity: 0;
    }
}

.kiwi-aboutbuffer-description,
.kiwi-aboutbuffer-topic {
    padding: 10px;
    background: rgba(128, 128, 128, 0.1);
    border-radius: 4px;
    line-height: 1.4em;
    word-break: break-word;
    margin-bottom: 10px;
}

.kiwi-aboutbuffer-topic-setby,
.kiwi-aboutbuffer-created {
    font-size: 0.85em;
    opacity: 0.7;
    font-style: italic;
}

.kiwi-aboutbuffer-usercount {
    text-align: center;
    margin-top: 10px;
}

.kiwi-aboutbuffer-invite {
    display: flex;
    width: 100%;
    box-sizing: border-box;
    margin-top: 10px;

    > input {
        flex-grow: 1;
        margin-right: 10px;
    }
}

.kiwi-aboutbuffer-invite-auto-complete {
    position: relative;
    margin-top: 1em;
    bottom: 0;
}

.kiwi-aboutbuffer-invite-auto-complete .kiwi-autocomplete-item {
    padding: 5px 11px;
}

.kiwi-aboutbuffer-highlight {
    cursor: pointer;
    padding: 5px 0;
    border-bottom: 1px solid rgba(128, 128, 128, 0.1);

    &:last-child {
        border-bottom: none;
    }
}

@media screen and (max-width: 769px) {
    .kiwi-sidebar.kiwi-sidebar-section-about {
        width: 100%;
        max-width: 100%;
    }
}
</style>
