'kiwi public';

import { Level, score } from './PwScore';

export { Level };

const LEVEL_LABELS = {
    [Level.EASY]: 'password_strength_easy',
    [Level.MEDIUM]: 'password_strength_medium',
    [Level.STRONG]: 'password_strength_strong',
    [Level.VERY_STRONG]: 'password_strength_very_strong',
    [Level.EXTREMELY_STRONG]: 'password_strength_extremely_strong',
};

/**
 * PwScore returns 0-14. Empty and non-string values are treated as 0 so the
 * UI can render a resting state without throwing.
 */
export function passwordScore(value) {
    if (typeof value !== 'string' || !value) {
        return 0;
    }

    try {
        return score(value);
    } catch (err) {
        return 0;
    }
}

export function levelForScore(value) {
    const points = Number(value) || 0;
    if (points <= 3) {
        return Level.EASY;
    }
    if (points <= 6) {
        return Level.MEDIUM;
    }
    if (points <= 9) {
        return Level.STRONG;
    }
    if (points <= 12) {
        return Level.VERY_STRONG;
    }
    return Level.EXTREMELY_STRONG;
}

export function passwordLevel(value) {
    return levelForScore(passwordScore(value));
}

export function passwordLevelLabelKey(value) {
    return LEVEL_LABELS[passwordLevel(value)] || LEVEL_LABELS[Level.EASY];
}

export function passwordLevelClass(value) {
    return 'kiwi-welcome-password-strength-level--' +
        passwordLevel(value).toLowerCase().replace(/_/g, '-');
}
