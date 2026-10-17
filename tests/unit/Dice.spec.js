import { parseRoll, rollDice, formatRoll } from '@/helpers/Dice';

function queuedRng(values) {
    const queue = values.slice();

    return (sides) => {
        const value = queue.length ? queue.shift() : 1;
        return Math.min(Math.max(value, 1), sides);
    };
}

function total(expression, rolls) {
    return rollDice(expression, queuedRng(rolls)).total;
}

describe('Dice helpers', () => {
    describe('rollDice', () => {
        it('rolls a NdM expression', () => {
            const result = rollDice('3d6', queuedRng([1, 2, 3]));

            expect(result.ok).toBe(true);
            expect(result.expression).toBe('3d6');
            expect(result.total).toBe(6);
            expect(result.diceGroups).toHaveLength(1);
            expect(result.diceGroups[0].rolls).toEqual([1, 2, 3]);
            expect(result.diceGroups[0].kept).toEqual([1, 2, 3]);
            expect(result.diceGroups[0].dropped).toEqual([]);
        });

        it('supports the dM shorthand', () => {
            const result = rollDice('d20', queuedRng([12]));

            expect(result.ok).toBe(true);
            expect(result.expression).toBe('1d20');
            expect(result.total).toBe(12);
            expect(result.diceGroups[0].count).toBe(1);
            expect(result.diceGroups[0].sides).toBe(20);
        });

        it('supports the Nd shorthand with a default of 6 sides', () => {
            const result = rollDice('4d', queuedRng([1, 2, 3, 4]));

            expect(result.ok).toBe(true);
            expect(result.expression).toBe('4d6');
            expect(result.total).toBe(10);
        });

        it('keeps the highest dice with k', () => {
            const result = rollDice('4d6k3', queuedRng([6, 5, 4, 3]));

            expect(result.expression).toBe('4d6k3');
            expect(result.total).toBe(15);
            expect(result.diceGroups[0].kept).toEqual([6, 5, 4]);
            expect(result.diceGroups[0].dropped).toEqual([3]);
        });

        it('normalises kh to k', () => {
            expect(rollDice('4d6kh3', queuedRng([1, 2, 3, 4])).expression).toBe('4d6k3');
        });

        it('keeps the lowest dice with kl', () => {
            const result = rollDice('4d6kl1', queuedRng([6, 5, 4, 3]));

            expect(result.expression).toBe('4d6kl1');
            expect(result.total).toBe(3);
            expect(result.diceGroups[0].kept).toEqual([3]);
            expect(result.diceGroups[0].dropped).toEqual([6, 5, 4]);
        });

        it('drops the lowest dice with dl (and the bare d shorthand)', () => {
            const result = rollDice('4d6d1', queuedRng([6, 5, 4, 3]));

            expect(result.expression).toBe('4d6dl1');
            expect(result.total).toBe(15);
            expect(result.diceGroups[0].kept).toEqual([6, 5, 4]);
            expect(result.diceGroups[0].dropped).toEqual([3]);
        });

        it('drops the highest dice with dh', () => {
            const result = rollDice('4d6dh1', queuedRng([6, 5, 4, 3]));

            expect(result.expression).toBe('4d6dh1');
            expect(result.total).toBe(12);
            expect(result.diceGroups[0].kept).toEqual([5, 4, 3]);
            expect(result.diceGroups[0].dropped).toEqual([6]);
        });

        it('clamps keep/drop amounts to the number of dice', () => {
            expect(rollDice('4d6k10', queuedRng([1, 2, 3, 4])).total).toBe(10);
            expect(rollDice('4d6d10', queuedRng([1, 2, 3, 4])).total).toBe(0);
        });

        it('handles arithmetic without any dice', () => {
            expect(total('2 + 2', [])).toBe(4);
            expect(total('4 * 3', [])).toBe(12);
            expect(rollDice('2 + 2', queuedRng([])).diceGroups).toHaveLength(0);
        });

        it('respects operator precedence', () => {
            expect(total('2+3*4', [])).toBe(14);
            expect(total('(2+3)*4', [])).toBe(20);
            expect(total('-5+10', [])).toBe(5);
        });

        it('rounds division towards 1', () => {
            expect(total('10/3', [])).toBe(3);
            expect(total('10/4', [])).toBe(2);
            expect(total('7/2', [])).toBe(3);
            expect(total('1/2', [])).toBe(1);
            expect(total('1/3', [])).toBe(1);
            expect(total('9/3', [])).toBe(3);
            expect(total('-10/3', [])).toBe(-3);
            expect(total('-1/2', [])).toBe(0);
        });

        it('combines dice with arithmetic', () => {
            expect(total('1d20+5', [12])).toBe(17);
            expect(total('(1d20+5)*2', [12])).toBe(34);
            expect(total('4d6k3*2', [6, 5, 4, 3])).toBe(30);
        });

        it('tracks separate dice groups', () => {
            const result = rollDice('2d6+1d8+3', queuedRng([1, 2, 3]));

            expect(result.total).toBe(9);
            expect(result.diceGroups).toHaveLength(2);
            expect(result.diceGroups[0].sides).toBe(6);
            expect(result.diceGroups[1].sides).toBe(8);
        });

        it('rejects invalid expressions', () => {
            expect(rollDice('').ok).toBe(false);
            expect(rollDice('   ').ok).toBe(false);
            expect(rollDice('abc').ok).toBe(false);
            expect(rollDice('d0').ok).toBe(false);
            expect(rollDice('0d6').ok).toBe(false);
            expect(rollDice('4d6h1').ok).toBe(false);
            expect(rollDice('4d6k3d1').ok).toBe(false);
            expect(rollDice('4d6k3+').ok).toBe(false);
            expect(rollDice('(1d6').ok).toBe(false);
            expect(rollDice('1/0').ok).toBe(false);
            expect(rollDice('101d6').ok).toBe(false);
            expect(rollDice('1d1000001').ok).toBe(false);
            expect(rollDice('1'.repeat(201)).ok).toBe(false);
        });

        it('rejects expressions with too many dice groups', () => {
            const expression = new Array(21).fill('1d6').join('+');
            expect(rollDice(expression, queuedRng([])).ok).toBe(false);
        });
    });

    describe('parseRoll', () => {
        it('normalises shorthand without rolling', () => {
            expect(parseRoll('4d6kh3')).toEqual({ normalised: '4d6k3', diceGroups: 1 });
            expect(parseRoll('2d6 + 1d8')).toEqual({ normalised: '2d6+1d8', diceGroups: 2 });
            expect(parseRoll('d')).toEqual({ normalised: '1d6', diceGroups: 1 });
        });

        it('returns null for invalid expressions', () => {
            expect(parseRoll('')).toBeNull();
            expect(parseRoll('abc')).toBeNull();
        });
    });

    describe('formatRoll', () => {
        function translate(calls) {
            return (key, params) => {
                calls.push({ key, params });
                return key;
            };
        }

        it('shows a breakdown for a single dice group', () => {
            const calls = [];
            const result = rollDice('4d6k3', queuedRng([6, 5, 4, 3]));

            formatRoll(result, translate(calls), String);

            expect(calls.map((call) => call.key)).toEqual(['dice_dropped', 'dice_roll_breakdown']);
            expect(calls[0].params).toEqual({ dice: '3' });
            expect(calls[1].params).toEqual({
                expression: '4d6k3',
                number: '15',
                dice: '6 + 5 + 4, dice_dropped',
            });
        });

        it('formats every number through formatNumber', () => {
            const calls = [];
            const result = rollDice('4d6k3', queuedRng([6, 5, 4, 3]));

            formatRoll(result, translate(calls), (value) => 'n' + value);

            expect(calls[0].params.dice).toBe('n3');
            expect(calls[1].params.number).toBe('n15');
            expect(calls[1].params.dice).toBe('n6 + n5 + n4, dice_dropped');
        });

        it('omits the dropped phrase when nothing was dropped', () => {
            const calls = [];
            const result = rollDice('3d6', queuedRng([1, 2, 3]));

            formatRoll(result, translate(calls), String);

            expect(calls).toHaveLength(1);
            expect(calls[0].params.dice).toBe('1 + 2 + 3');
        });

        it('only shows the total for several dice groups', () => {
            const calls = [];
            const result = rollDice('2d6+1d8', queuedRng([1, 2, 3]));

            formatRoll(result, translate(calls), String);

            expect(calls).toHaveLength(1);
            expect(calls[0].key).toBe('dice_roll_result');
            expect(calls[0].params).toEqual({ expression: '2d6+1d8', number: '6' });
        });

        it('only shows the total for plain arithmetic', () => {
            const calls = [];
            const result = rollDice('2+2', queuedRng([]));

            formatRoll(result, translate(calls), String);

            expect(calls).toHaveLength(1);
            expect(calls[0].key).toBe('dice_roll_result');
        });
    });
});
