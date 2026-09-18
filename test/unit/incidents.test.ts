import { incidentsCommand } from '../../src/cli/commands/incidents';
import { mockApi, useEnvAuth, printed } from './_mockApi';

describe('incidents', () => {
    useEnvAuth();

    const rows = [
        { id: 'inc1', kind: 'breach', openedAt: '2026-09-16T10:00:00Z', resolvedAt: null, ackedAt: null, notifyCount: 2, level: 'alert', peakLevel: 'alert', invariantId: 'inv1', name: 'Treasury floor', exprText: 'bal >= 25000', warnExprText: null, enabled: true, chainId: 1, address: '0x1111111111111111111111111111111111111111' },
        { id: 'inc0', kind: 'breach', openedAt: '2026-09-10T10:00:00Z', resolvedAt: '2026-09-10T11:00:00Z', ackedAt: '2026-09-10T10:05:00Z', notifyCount: 1, level: 'warning', peakLevel: 'warning', invariantId: 'inv1', name: 'Treasury floor', exprText: 'bal >= 25000', warnExprText: 'bal >= 30000', enabled: true, chainId: null, address: null },
    ];

    it('list passes --days/--limit and prints open vs resolved', async () => {
        const calls = mockApi({ 'GET /api/mainnet/incidents': () => ({ payload: { incidents: rows, days: 30 } }) });
        await incidentsCommand(['--days', '30', '--limit', '10']);
        expect(calls[0].path).toBe('/api/mainnet/incidents?days=30&limit=10');
        const out = printed();
        expect(out[0]).toMatch(/^inc1 {2}alert {3}2026-09-16T10:00:00Z {2}OPEN {30} Treasury floor — bal >= 25000 {2}\[chain 1 0x1111…1111\]$/);
        expect(out[1]).toMatch(/resolved 2026-09-10T11:00:00Z.*acked$/);
        await expect(incidentsCommand(['--days', '0'])).rejects.toThrow(/--days/);
    });

    it('empty window', async () => {
        mockApi({ 'GET /api/mainnet/incidents': () => ({ payload: { incidents: [], days: 1 } }) });
        await incidentsCommand([]);
        expect(printed()[0]).toBe('No incidents in the last 1 day.');
    });

    it('show prints evidence per input and every delivery', async () => {
        mockApi({
            'GET /api/mainnet/incidents/inc1': () => ({
                payload: {
                    incident: {
                        id: 'inc1', kind: 'breach', openedAt: '2026-09-16T10:00:00Z', resolvedAt: null, level: 'alert', peakLevel: 'alert', alertedAt: '2026-09-16T10:01:00Z',
                        openInputs: { bal: { raw: '0x01', at: '2026-09-16T10:00:00Z', block: '0x10' } },
                        alertInputs: null,
                        ackedAt: '2026-09-16T10:30:00Z', ackedBy: { name: 'Theo', email: null }, notifyCount: 2,
                        deliveries: [
                            { id: 'd1', round: 0, status: 'sent', attempts: 1, lastError: null, sentAt: '2026-09-16T10:00:05Z', channel: { id: 'ch1', kind: 'telegram', label: null } },
                            { id: 'd2', round: 1, status: 'failed', attempts: 3, lastError: 'chat not found', sentAt: null, channel: { id: 'ch2', kind: 'discord_bot', label: '#alerts' } },
                        ],
                        invariant: { id: 'inv1', name: 'Treasury floor', exprText: 'bal >= 25000', warnExprText: null, inputs: [{ alias: 'bal', trackedOnchainValue: { id: 'm1', chainId: 1, address: '0x1111111111111111111111111111111111111111', kind: 'nativeBalance', label: 'Bal', lastValue: 24000 } }] },
                    },
                },
            }),
        });
        await incidentsCommand(['show', 'inc1']);
        const out = printed().join('\n');
        expect(out).toMatch(/OPEN {2}— peaked at alert, opened 2026-09-16T10:00:00Z, escalated 2026-09-16T10:01:00Z/);
        expect(out).toMatch(/acked: {2}2026-09-16T10:30:00Z by Theo/);
        expect(out).toMatch(/bal {21} raw 0x01 @ block 0x10 {3}now 24,000/);
        expect(out).toMatch(/round 0 {2}sent {6}telegram ch1 {2}sent 2026-09-16T10:00:05Z/);
        expect(out).toMatch(/round 1 {2}failed {4}discord_bot #alerts {2}error: chat not found/);
    });

    it('ack / unack PATCH the flag', async () => {
        const calls = mockApi({ 'PATCH /api/mainnet/incidents/inc1': (c) => ({ payload: { incident: { id: 'inc1', ackedAt: c.body.acked ? 'now' : null } } }) });
        await incidentsCommand(['ack', 'inc1']);
        await incidentsCommand(['unack', 'inc1']);
        expect(calls.map((c) => c.body)).toEqual([{ acked: true }, { acked: false }]);
    });
});
