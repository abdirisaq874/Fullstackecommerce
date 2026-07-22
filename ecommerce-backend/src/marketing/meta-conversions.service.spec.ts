import { createHash } from 'crypto';

// SHA-256 helper mirroring Meta's normalization, for asserting hashed fields.
const sha = (v: string) => createHash('sha256').update(v).digest('hex');

describe('MetaConversionsService', () => {
  const basePurchase = {
    eventId: 'order-1',
    value: 49.9,
    currency: 'USD',
    contentIds: ['red-shoes'],
    contents: [{ id: 'red-shoes', quantity: 1 }],
    numItems: 1,
  };

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.META_CAPI_ACCESS_TOKEN;
    delete process.env.META_PIXEL_ID;
  });

  it('no-ops (no network) when no access token is configured', async () => {
    jest.resetModules();
    delete process.env.META_CAPI_ACCESS_TOKEN;
    const { MetaConversionsService } = require('./meta-conversions.service');
    const svc = new MetaConversionsService();
    const fetchSpy = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ ok: true, text: async () => '' } as any);

    expect(svc.enabled).toBe(false);
    await svc.sendPurchase(basePurchase);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts a hashed, deduped Purchase when a token is set', async () => {
    jest.resetModules();
    process.env.META_CAPI_ACCESS_TOKEN = 'test-token';
    process.env.META_PIXEL_ID = '123';
    const { MetaConversionsService } = require('./meta-conversions.service');
    const svc = new MetaConversionsService();

    let captured: any;
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      captured = { url, body: JSON.parse(init.body) };
      return { ok: true, text: async () => 'ok' } as any;
    });

    expect(svc.enabled).toBe(true);
    await svc.sendPurchase({
      ...basePurchase,
      user: {
        email: 'Test@Example.com ',
        phone: '+1 (212) 555-1234',
        firstName: 'Jane',
        externalId: 'u1',
      },
      context: { ip: '1.2.3.4', userAgent: 'UA', fbp: 'fb.1.x', fbc: 'fb.1.y' },
    });

    expect(captured.url).toContain('/123/events');
    expect(captured.url).toContain('access_token=test-token');

    const evt = captured.body.data[0];
    expect(evt.event_name).toBe('Purchase');
    expect(evt.event_id).toBe('order-1'); // == browser eventID → Meta dedups
    expect(evt.action_source).toBe('website');
    expect(evt.custom_data.value).toBe(49.9);
    expect(evt.custom_data.content_ids).toEqual(['red-shoes']);

    // email normalized (trim + lowercase) then SHA-256
    expect(evt.user_data.em).toEqual([sha('test@example.com')]);
    // phone reduced to digits then SHA-256
    expect(evt.user_data.ph).toEqual([sha('12125551234')]);
    expect(evt.user_data.fn).toEqual([sha('jane')]);
    expect(evt.user_data.external_id).toEqual([sha('u1')]);
    // raw (unhashed) match signals
    expect(evt.user_data.client_ip_address).toBe('1.2.3.4');
    expect(evt.user_data.client_user_agent).toBe('UA');
    expect(evt.user_data.fbp).toBe('fb.1.x');
    expect(evt.user_data.fbc).toBe('fb.1.y');
  });

  it('never throws when Meta returns an error', async () => {
    jest.resetModules();
    process.env.META_CAPI_ACCESS_TOKEN = 'test-token';
    const { MetaConversionsService } = require('./meta-conversions.service');
    const svc = new MetaConversionsService();
    jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' } as any);

    await expect(svc.sendPurchase(basePurchase)).resolves.toBeUndefined();
  });
});
