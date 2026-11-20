import desktop from './index';

const BEAT_MS = 1000;
const LONG_TASK_MS = 250;
const wrappedDialogs = new Set();

let started = false;
let phase = 'idle';
let beatTimer = null;
let observer = null;

function report(payload) {
    if (!desktop.diagnostics.isAvailable()) {
        return;
    }
    desktop.diagnostics.event(Object.assign({
        at: Date.now(),
        phase,
    }, payload));
}

export function setDiagnosticPhase(next) {
    if (typeof next !== 'string' || !next || next === phase) {
        return;
    }
    phase = next;
    report({ type: 'phase', phase });
}

function wrapDialog(name) {
    if (wrappedDialogs.has(name)) {
        return;
    }
    const original = window[name];
    if (typeof original !== 'function') {
        return;
    }

    function wrapped(...args) {
        const previous = phase;
        setDiagnosticPhase('dialog');
        try {
            return original.apply(window, args);
        } finally {
            setDiagnosticPhase(previous === 'dialog' ? 'idle' : previous);
        }
    }

    wrappedDialogs.add(name);
    window[name] = wrapped;
}

export function startFreezeBeacon() {
    if (started || !desktop.isDesktop() || !desktop.diagnostics.isAvailable()) {
        return;
    }
    started = true;

    report({ type: 'start' });
    beatTimer = setInterval(() => {
        report({ type: 'beat' });
    }, BEAT_MS);

    if (typeof PerformanceObserver === 'function') {
        try {
            observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.duration < LONG_TASK_MS) {
                        return;
                    }
                    report({
                        type: 'longtask',
                        durationMs: entry.duration,
                        name: entry.name || '',
                    });
                });
            });
            observer.observe({ entryTypes: ['longtask'] });
        } catch (err) {
            observer = null;
        }
    }

    window.addEventListener('focus', () => setDiagnosticPhase('focus'));
    window.addEventListener('blur', () => setDiagnosticPhase('blur'));
    document.addEventListener('visibilitychange', () => {
        setDiagnosticPhase(document.visibilityState === 'visible' ? 'visible' : 'hidden');
    });

    wrapDialog('confirm');
    wrapDialog('alert');
}

export function stopFreezeBeacon() {
    if (beatTimer) {
        clearInterval(beatTimer);
    }
    beatTimer = null;
    if (observer) {
        observer.disconnect();
    }
    observer = null;
    started = false;
}
