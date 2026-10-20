'kiwi public';

// Rough, dependency-free password strength score.
//
// 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong.
//
// This is advisory only: the account-registration capability's minimum and
// maximum lengths are the only rules that are actually enforced.
export function passwordScore(password) {
    const value = typeof password === 'string' ? password : '';
    if (!value) {
        return 0;
    }

    let score = 0;
    if (value.length >= 8) {
        score += 1;
    }
    if (value.length >= 12) {
        score += 1;
    }
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) {
        score += 1;
    }
    if (/\d/.test(value)) {
        score += 1;
    }
    if (/[^a-z0-9]/i.test(value)) {
        score += 1;
    }

    // Repeated runs and very common sequences read as weak choices.
    if (
        /(.)\1{2,}/.test(value) ||
        /(abc|bcd|cde|123|234|345|456|567|678|789|qwerty|password)/i.test(value)
    ) {
        score -= 1;
    }

    return Math.min(4, Math.max(1, score));
}
