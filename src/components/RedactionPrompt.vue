<template>
    <div v-if="visible" class="kiwi-redactionprompt-wrapper" @click.self="cancel">
        <div class="kiwi-redactionprompt">
            <div class="kiwi-redactionprompt-header">
                <h3>{{ $t('confirm_redaction_title') }}</h3>
                <i class="fa fa-times" aria-hidden="true" @click="cancel" />
            </div>
            <div class="kiwi-redactionprompt-body">
                <p class="kiwi-redactionprompt-warn">{{ $t('confirm_redaction_warn') }}</p>
                <div class="u-form">
                    <label>
                        <span>{{ $t('redaction_reason') }}</span>
                        <input
                            v-model="reason"
                            v-focus
                            type="text"
                            class="u-input"
                            :placeholder="$t('redaction_reason')"
                            @keydown.enter="submit"
                            @keydown.esc="cancel"
                        >
                    </label>
                </div>
            </div>
            <div class="kiwi-redactionprompt-footer">
                <button type="button" class="u-button u-button-secondary" @click="cancel">{{ $t('cancel') }}</button>
                <button type="button" class="u-button u-button-warning" @click="submit">{{ $t('redact') }}</button>
            </div>
        </div>
    </div>
</template>

<script>
'kiwi public';

export default {
    data() {
        return {
            reason: '',
        };
    },
    computed: {
        visible() {
            return this.$state.ui.redaction_prompt.visible;
        },
        message() {
            return this.$state.ui.redaction_prompt.message;
        },
        buffer() {
            return this.$state.ui.redaction_prompt.buffer;
        },
    },
    methods: {
        cancel() {
            this.$state.ui.redaction_prompt.visible = false;
            this.$state.ui.redaction_prompt.message = null;
            this.$state.ui.redaction_prompt.buffer = null;
            this.reason = '';
        },
        submit() {
            if (this.buffer && this.message) {
                this.buffer.redact(this.message, this.reason);
            }
            this.cancel();
        },
    },
};
</script>

<style lang="less">
.kiwi-redactionprompt-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.kiwi-redactionprompt {
    width: 400px;
    max-width: 90%;
    background: var(--brand-default-bg, #fff);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.kiwi-redactionprompt-header {
    padding: 15px 20px;
    background: var(--brand-primary, #4285f4);
    color: var(--brand-default-bg, #fff);
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
        margin: 0;
        font-size: 1.1em;
    }

    i {
        cursor: pointer;
        font-size: 1.2em;
        opacity: 0.8;

        &:hover {
            opacity: 1;
        }
    }
}

.kiwi-redactionprompt-body {
    padding: 20px;

    p {
        margin: 0 0 15px 0;
    }
}

.kiwi-redactionprompt-warn {
    font-weight: 600;
    color: var(--brand-error, #f44336);
}

.kiwi-redactionprompt-footer {
    padding: 15px 20px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--brand-midtone, #eee);

    .u-button {
        padding: 8px 16px;
    }
}
</style>
