'kiwi public';

/** @module */

// Limits to keep rolls small enough to broadcast into a channel
const MAX_DICE_PER_GROUP = 100;
const MAX_SIDES = 1000000;
const MAX_DICE_GROUPS = 20;
const MAX_EXPRESSION_LENGTH = 200;
const MAX_DEPTH = 10;

class DiceError extends Error {
    constructor(reason) {
        super(reason);
        this.name = 'DiceError';
        this.reason = reason;
    }
}

/**
 * Random integer between 1 and sides, inclusive.
 * Uses the Web Crypto API when available so rolls are not biased by the
 * implementation of Math.random.
 */
function randomInt(sides) {
    const cryptoObj = (typeof window !== 'undefined' && window.crypto)
        || (typeof crypto !== 'undefined' ? crypto : null);

    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
        const range = 0x100000000;
        const limit = Math.floor(range / sides) * sides;
        const buffer = new Uint32Array(1);
        let value;

        do {
            cryptoObj.getRandomValues(buffer);
            value = buffer[0];
        } while (value >= limit);

        return (value % sides) + 1;
    }

    return Math.floor(Math.random() * sides) + 1;
}

/**
 * Division rounds towards 1: values above 1 drop the fraction, values below 1
 * round up towards 1.
 */
function roundTowardsOne(value) {
    if (value === 1) {
        return 1;
    }

    const rounded = value > 1 ? Math.floor(value) : Math.ceil(value);
    return rounded === 0 ? 0 : rounded;
}

/*
 * Recursive descent parser for dice expressions.
 *
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | '/') unary)*
 *   unary   := '-' unary | primary
 *   primary := number | dice | '(' expr ')'
 *   dice    := [count] 'd' [sides] [keep | drop]
 *            | count 'd'                  (Nd shorthand, sides default to 6)
 *            | 'd' sides [keep | drop]    (dM shorthand, count defaults to 1)
 *   keep    := ('kh' | 'k' | 'kl') [amount]   (default amount 1)
 *   drop    := ('dh' | 'dl' | 'd')  [amount]  (default amount 1)
 *
 * A bare number is a plain value, so use 'd20' (or '1d20') for a die roll.
 */
class DiceParser {
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.depth = 0;
        this.diceGroups = 0;
    }

    error(reason) {
        throw new DiceError(reason);
    }

    peek(offset = 0) {
        return this.input[this.pos + offset] || '';
    }

    skipSpace() {
        while (/\s/.test(this.peek())) {
            this.pos += 1;
        }
    }

    parse() {
        this.skipSpace();
        const node = this.expr();
        this.skipSpace();

        if (this.pos < this.input.length) {
            this.error('unexpected-token');
        }

        return node;
    }

    expr() {
        let node = this.term();
        this.skipSpace();

        while (this.peek() === '+' || this.peek() === '-') {
            const op = this.peek();
            this.pos += 1;
            const right = this.term();
            node = {
                type: 'binary',
                op,
                left: node,
                right,
                normalised: node.normalised + op + right.normalised,
            };
            this.skipSpace();
        }

        return node;
    }

    term() {
        let node = this.unary();
        this.skipSpace();

        while (this.peek() === '*' || this.peek() === '/') {
            const op = this.peek();
            this.pos += 1;
            const right = this.unary();
            node = {
                type: 'binary',
                op,
                left: node,
                right,
                normalised: node.normalised + op + right.normalised,
            };
            this.skipSpace();
        }

        return node;
    }

    unary() {
        this.skipSpace();

        if (this.peek() === '-') {
            this.pos += 1;
            const node = this.unary();
            return { type: 'negate', node, normalised: '-' + node.normalised };
        }

        return this.primary();
    }

    primary() {
        this.skipSpace();
        const char = this.peek();

        if (char === '(') {
            this.pos += 1;
            this.depth += 1;
            if (this.depth > MAX_DEPTH) {
                this.error('too-deep');
            }

            const node = this.expr();
            this.skipSpace();
            if (this.peek() !== ')') {
                this.error('unbalanced');
            }

            this.pos += 1;
            this.depth -= 1;
            return { type: 'group', node, normalised: '(' + node.normalised + ')' };
        }

        if (/[0-9]/.test(char)) {
            return this.number();
        }

        if (char.toLowerCase() === 'd') {
            this.pos += 1;
            return this.dice(1);
        }

        this.error('unexpected-token');
        return null;
    }

    number() {
        const start = this.pos;
        while (/[0-9]/.test(this.peek())) {
            this.pos += 1;
        }

        const value = parseInt(this.input.slice(start, this.pos), 10);

        if (this.peek().toLowerCase() === 'd') {
            this.pos += 1;
            return this.dice(value);
        }

        return { type: 'number', value, normalised: String(value) };
    }

    dice(count) {
        const start = this.pos;
        while (/[0-9]/.test(this.peek())) {
            this.pos += 1;
        }

        let sides = 6;
        if (this.pos > start) {
            sides = parseInt(this.input.slice(start, this.pos), 10);
        }

        if (count < 1 || count > MAX_DICE_PER_GROUP) {
            this.error('invalid-count');
        }

        if (sides < 1 || sides > MAX_SIDES) {
            this.error('invalid-sides');
        }

        this.diceGroups += 1;
        if (this.diceGroups > MAX_DICE_GROUPS) {
            this.error('too-many-groups');
        }

        const keep = this.modifier('keep');
        const drop = this.modifier('drop');
        if (keep && drop) {
            this.error('keep-and-drop');
        }

        let normalised = count + 'd' + sides;
        if (keep) {
            normalised += (keep.type === 'high' ? 'k' : 'kl') + keep.amount;
        } else if (drop) {
            normalised += (drop.type === 'low' ? 'dl' : 'dh') + drop.amount;
        }

        return {
            type: 'dice',
            count,
            sides,
            keep,
            drop,
            normalised,
        };
    }

    modifier(kind) {
        const pair = this.input.slice(this.pos, this.pos + 2).toLowerCase();
        const char = this.peek().toLowerCase();

        let type = null;
        let matched = 0;

        if (kind === 'keep') {
            if (pair === 'kh') {
                type = 'high';
                matched = 2;
            } else if (pair === 'kl') {
                type = 'low';
                matched = 2;
            } else if (char === 'k') {
                type = 'high';
                matched = 1;
            }
        } else if (kind === 'drop') {
            if (pair === 'dh') {
                type = 'high';
                matched = 2;
            } else if (pair === 'dl') {
                type = 'low';
                matched = 2;
            } else if (char === 'd') {
                type = 'low';
                matched = 1;
            }
        }

        if (!matched) {
            return null;
        }

        this.pos += matched;

        const start = this.pos;
        while (/[0-9]/.test(this.peek())) {
            this.pos += 1;
        }

        let amount = 1;
        if (this.pos > start) {
            amount = parseInt(this.input.slice(start, this.pos), 10);
        }

        return { type, amount };
    }
}

function rollGroup(node, rng) {
    const rolls = [];
    for (let i = 0; i < node.count; i += 1) {
        rolls.push(rng(node.sides));
    }

    const indexes = rolls.map((value, index) => index);

    let keptIndexes = indexes;
    let droppedIndexes = [];

    if (node.keep) {
        const amount = Math.min(Math.max(node.keep.amount, 0), node.count);
        const sorted = indexes.slice().sort((a, b) => (
            node.keep.type === 'high' ? rolls[b] - rolls[a] : rolls[a] - rolls[b]
        ));
        keptIndexes = sorted.slice(0, amount);
        droppedIndexes = sorted.slice(amount);
    } else if (node.drop) {
        const amount = Math.min(Math.max(node.drop.amount, 0), node.count);
        const sorted = indexes.slice().sort((a, b) => (
            node.drop.type === 'low' ? rolls[a] - rolls[b] : rolls[b] - rolls[a]
        ));
        droppedIndexes = sorted.slice(0, amount);
        keptIndexes = sorted.slice(amount);
    }

    const keptSet = new Set(keptIndexes);
    const droppedSet = new Set(droppedIndexes);
    const kept = indexes.filter((index) => keptSet.has(index)).map((index) => rolls[index]);
    const dropped = indexes.filter((index) => droppedSet.has(index)).map((index) => rolls[index]);
    const subtotal = kept.reduce((sum, value) => sum + value, 0);

    return {
        count: node.count,
        sides: node.sides,
        keep: node.keep,
        drop: node.drop,
        rolls,
        kept,
        dropped,
        subtotal,
    };
}

function evaluate(node, groups, rng) {
    switch (node.type) {
    case 'number':
        return node.value;
    case 'negate':
        return -evaluate(node.node, groups, rng);
    case 'group':
        return evaluate(node.node, groups, rng);
    case 'binary': {
        const left = evaluate(node.left, groups, rng);
        const right = evaluate(node.right, groups, rng);

        if (node.op === '+') {
            return left + right;
        }
        if (node.op === '-') {
            return left - right;
        }
        if (node.op === '*') {
            return left * right;
        }
        if (node.op === '/') {
            if (right === 0) {
                throw new DiceError('divide-by-zero');
            }

            return roundTowardsOne(left / right);
        }

        throw new DiceError('unexpected-token');
    }
    case 'dice': {
        const group = rollGroup(node, rng);
        groups.push(group);
        return group.subtotal;
    }
    default:
        throw new DiceError('unexpected-token');
    }
}

/* Trim and length-check an expression, returning '' if it can not be used */
function normaliseExpression(expression) {
    if (typeof expression !== 'string') {
        return '';
    }

    const trimmed = expression.trim();
    if (!trimmed || trimmed.length > MAX_EXPRESSION_LENGTH) {
        return '';
    }

    return trimmed;
}

/**
 * Validate an expression without rolling anything.
 * Returns { normalised, diceGroups } or null when the expression is invalid.
 */
export function parseRoll(expression) {
    const input = normaliseExpression(expression);
    if (!input) {
        return null;
    }

    const parser = new DiceParser(input);
    try {
        const node = parser.parse();
        return {
            normalised: node.normalised,
            diceGroups: parser.diceGroups,
        };
    } catch (err) {
        return null;
    }
}

/**
 * Roll an expression. Returns { ok: true, expression, total, diceGroups } on
 * success, or { ok: false, error, expression } when the expression is invalid.
 * `rng` is primarily used by tests to make rolls deterministic.
 */
export function rollDice(expression, rng = randomInt) {
    const input = normaliseExpression(expression);
    if (!input) {
        return { ok: false, error: 'invalid', expression: '' };
    }

    const parser = new DiceParser(input);
    let node;
    try {
        node = parser.parse();
    } catch (err) {
        return { ok: false, error: err.reason || 'invalid', expression: input };
    }

    const groups = [];
    let total;
    try {
        total = evaluate(node, groups, rng);
    } catch (err) {
        return { ok: false, error: err.reason || 'invalid', expression: node.normalised };
    }

    return {
        ok: true,
        expression: node.normalised,
        total,
        diceGroups: groups,
    };
}

/**
 * Build the message to announce for a roll result. `t` is the translation
 * lookup and `formatNumber` formats the individual numbers.
 *
 * Rolls made up of a single dice group get a full breakdown, everything else
 * (plain arithmetic, or several separate dice groups) only shows the total.
 */
export function formatRoll(result, t, formatNumber = (value) => String(value)) {
    const format = (value) => formatNumber(value);

    if (result.diceGroups.length !== 1) {
        return t('dice_roll_result', {
            expression: result.expression,
            number: format(result.total),
        });
    }

    const group = result.diceGroups[0];
    const kept = group.kept.map(format).join(' + ');
    const dropped = group.dropped.map(format).join(', ');

    let dice = kept;
    if (dropped) {
        const droppedLabel = t('dice_dropped', { dice: dropped });
        dice = kept ? (kept + ', ' + droppedLabel) : droppedLabel;
    }

    return t('dice_roll_breakdown', {
        expression: result.expression,
        number: format(result.total),
        dice,
    });
}
