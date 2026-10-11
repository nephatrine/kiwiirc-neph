<template>
    <div class="kiwi-buffersettings">
        <div class="kiwi-buffersettings-alerts">
            <h3>{{ $t('settings_notify') }}</h3>
            <hr>
            <form class="u-form">
                <label class="u-checkbox-wrapper">
                    <input v-model="settingAlertOn" type="radio" name="alert_on" value="message">
                    <span>{{ $t('settings_notify_all') }}</span>
                </label>
                <label class="u-checkbox-wrapper">
                    <input v-model="settingAlertOn" type="radio" name="alert_on" value="highlight">
                    <span>{{ $t('settings_notify_mentioned') }}</span>
                </label>
                <label class="u-checkbox-wrapper">
                    <input v-model="settingAlertOn" type="radio" name="alert_on" value="never">
                    <span>{{ $t('settings_notify_never') }}</span>
                </label>
            </form>

            <h3>{{ $t('settings') }}</h3>
            <hr>
            <form class="u-form">
                <label class="u-checkbox-wrapper">
                    <span>{{ $t('settings_notify_mute') }}</span>
                    <input v-model="settingMuteSound" :disabled="settingAlertOn === 'never'" type="checkbox">
                </label>
                <label class="u-checkbox-wrapper">
                    <span>{{ $t('settings_show_message_counts') }}</span>
                    <input v-model="settingHideMessageCount" type="checkbox">
                </label>
            </form>
        </div>
    </div>
</template>

<script>
'kiwi public';

export default {
    props: ['buffer'],
    computed: {
        settingAlertOn: {
            get: function getSettingAlertOn() {
                return this.buffer.setting('alert_on');
            },
            set: function setSettingAlertOn(val) {
                let network = this.buffer.getNetwork();
                let netId = network.connection.bncnetid;
                if (netId) {
                    // If this buffer is on a BOUNCER account, update the setting there too
                    network.ircClient.raw(
                        `BOUNCER changebuffer ${netId} ${this.buffer.name} notify=${val}`
                    );
                }

                if (val === 'never') {
                    this.buffer.setting('mute_sound', true);
                }

                return this.buffer.setting('alert_on', val);
            },
        },
        settingMuteSound: {
            get: function getsettingMuteSound() {
                return this.buffer.setting('mute_sound');
            },
            set: function setsettingMuteSound(val) {
                return this.buffer.setting('mute_sound', val);
            },
        },
        settingHideMessageCount: {
            get: function getsettingHideMessageCount() {
                return this.buffer.setting('hide_message_counts');
            },
            set: function setsettingHideMessageCount(val) {
                return this.buffer.setting('hide_message_counts', val);
            },
        },
    },
};
</script>

<style>
.kiwi-buffersettings {
    box-sizing: border-box;
}

.kiwi-buffersettings-alerts {
    margin-bottom: 1em;
}

.kiwi-buffersettings h3 {
    margin-top: 20px;
    margin-bottom: 5px;
    font-size: 1.1em;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.7;
}

.kiwi-buffersettings hr {
    margin-bottom: 15px;
    opacity: 0.2;
}

.kiwi-buffersettings .u-form label {
    display: block;
    margin-bottom: 10px;
}

.kiwi-buffersettings .u-form label span {
    display: block;
    font-weight: bold;
    margin-bottom: 5px;
}

.kiwi-buffersettings .u-checkbox-wrapper {
    display: flex;
    align-items: center;
}

.kiwi-buffersettings .u-checkbox-wrapper span {
    order: 2;
    margin-bottom: 0;
    font-weight: normal;
    margin-left: 10px;
}

.kiwi-buffersettings .u-checkbox-wrapper input {
    order: 1;
}
</style>
