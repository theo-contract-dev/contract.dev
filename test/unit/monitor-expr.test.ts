import { buildBoundExpr, buildCompareExpr, buildWarnCompareExpr, decimalToRational, parseUntil, toAlias } from '../../src/cli/monitor-expr';

describe('monitor expressions (mirror of the app AST)', () => {
    it('decimalToRational keeps thresholds exact', () => {
        expect(decimalToRational('25000')).toEqual({ num: '25000', den: '1' });
        expect(decimalToRational('1.02')).toEqual({ num: '102', den: '100' });
        expect(decimalToRational('-0.5')).toEqual({ num: '-5', den: '10' });
        expect(decimalToRational('25,000')).toEqual({ num: '25000', den: '1' });
        expect(decimalToRational('1e18')).toBeNull();
        expect(decimalToRational('abc')).toBeNull();
    });

    it('toAlias makes an identifier the way the composer does', () => {
        expect(toAlias('Treasury · Native balance')).toBe('treasury_native_balance');
        expect(toAlias('USDC supply')).toBe('usdc_supply');
        expect(toAlias('0x1111…1111.convertToAssets')).toBe('_0x1111_1111_converttoassets');
        expect(toAlias('···')).toBe('value');
        expect(toAlias('a'.repeat(60))).toHaveLength(40);
    });

    it('bound / compare exprs', () => {
        expect(buildBoundExpr('bal', 'gte', '25000')).toEqual({
            type: 'cmp',
            op: 'gte',
            lhs: { type: 'ref', alias: 'bal' },
            rhs: { type: 'lit', num: '25000', den: '1' },
        });
        expect(() => buildBoundExpr('bal', 'gte', '25k')).toThrow(/plain number/);
        expect(buildCompareExpr('a', 'lte', 'b')).toEqual({ type: 'cmp', op: 'lte', lhs: { type: 'ref', alias: 'a' }, rhs: { type: 'ref', alias: 'b' } });
        expect(() => buildCompareExpr('a', 'lte', 'a')).toThrow();
    });

    it('a percentage warning scales the right-hand metric, flipping for caps', () => {
        expect(buildWarnCompareExpr('reserves', 'gte', 'liabilities', '5').rhs).toEqual({
            type: 'ref',
            alias: 'liabilities',
            scale: { num: '105', den: '100' },
        });
        expect(buildWarnCompareExpr('a', 'lte', 'b', '2.5').rhs).toEqual({ type: 'ref', alias: 'b', scale: { num: '975', den: '1000' } });
        expect(() => buildWarnCompareExpr('a', 'gte', 'b', '0')).toThrow(/greater than 0/);
        expect(() => buildWarnCompareExpr('a', 'lte', 'b', '100')).toThrow(/under 100/);
    });

    it('parseUntil takes durations and dates', () => {
        const now = new Date('2026-09-16T12:00:00Z');
        expect(parseUntil('30m', now).toISOString()).toBe('2026-09-16T12:30:00.000Z');
        expect(parseUntil('2h', now).toISOString()).toBe('2026-09-16T14:00:00.000Z');
        expect(parseUntil('1d', now).toISOString()).toBe('2026-09-17T12:00:00.000Z');
        expect(parseUntil('2026-10-01T00:00:00Z', now).toISOString()).toBe('2026-10-01T00:00:00.000Z');
        expect(() => parseUntil('soon', now)).toThrow(/duration/);
    });
});
