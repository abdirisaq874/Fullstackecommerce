// Covers the two places this service can be silently wrong: Meta's mixed money
// units, and its habit of reporting one conversion under several action_type
// aliases.
describe('MetaMarketingService', () => {
  const load = (env: Record<string, string> = {}) => {
    jest.resetModules();
    delete process.env.META_MARKETING_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;
    Object.assign(process.env, env);
    const { MetaMarketingService } = require('./meta-marketing.service');
    return new MetaMarketingService();
  };

  const okJson = (body: unknown) =>
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => body } as any);

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.META_MARKETING_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;
  });

  it('no-ops (no network) when no marketing token is configured', async () => {
    const svc = load();
    const fetchSpy = okJson({});

    expect(svc.enabled).toBe(false);
    expect(await svc.getAccountSummary()).toBeNull();
    expect(await svc.getInsights()).toBeNull();
    expect(await svc.getCampaigns()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('converts minor-unit money fields and flags a non-serving account', async () => {
    const svc = load({ META_MARKETING_TOKEN: 't', META_AD_ACCOUNT_ID: 'act_1' });
    okJson({
      name: 'Gaarsii Global Ads',
      account_status: 3, // UNSETTLED — campaigns look ACTIVE but nothing serves
      currency: 'TRY',
      balance: '6004',
      amount_spent: '1649',
      spend_cap: '400000',
    });

    const s = await svc.getAccountSummary();
    expect(s).toMatchObject({
      status: 'UNSETTLED',
      serving: false,
      balance: 60.04,
      amountSpent: 16.49,
      spendCap: 4000,
    });
  });

  it('counts an aliased conversion once, and leaves spend in major units', async () => {
    const svc = load({ META_MARKETING_TOKEN: 't', META_AD_ACCOUNT_ID: 'act_1' });
    okJson({
      data: [
        {
          date_start: '2026-07-10',
          date_stop: '2026-08-08',
          spend: '21.22', // already major units — must NOT be divided by 100
          impressions: '1400',
          reach: '1328',
          clicks: '19',
          ctr: '1.357143',
          cpc: '1.116842',
          actions: [
            // one purchase, reported under three names
            { action_type: 'purchase', value: '1' },
            { action_type: 'omni_purchase', value: '1' },
            { action_type: 'offsite_conversion.fb_pixel_purchase', value: '1' },
            { action_type: 'link_click', value: '15' },
          ],
        },
      ],
    });

    const i = await svc.getInsights('last_30d');
    expect(i.spend).toBe(21.22);
    expect(i.impressions).toBe(1400);
    expect(i.roas).toBeNull(); // no purchase_roas returned
    expect(i.conversions.purchases).toBe(1); // not 3
    expect(i.conversions.linkClicks).toBe(15);
    expect(i.conversions.addToCart).toBe(0);
  });

  it('degrades to null when Meta returns an error payload', async () => {
    const svc = load({ META_MARKETING_TOKEN: 't', META_AD_ACCOUNT_ID: 'act_1' });
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: '(#200) Missing Permissions' } }),
    } as any);

    expect(await svc.getInsights()).toBeNull();
  });

  it('caches within the TTL so a dashboard refresh loop does not re-hit Meta', async () => {
    const svc = load({ META_MARKETING_TOKEN: 't', META_AD_ACCOUNT_ID: 'act_1' });
    const fetchSpy = okJson({ name: 'A', account_status: 1, currency: 'TRY', balance: '0', amount_spent: '0' });

    await svc.getAccountSummary();
    await svc.getAccountSummary();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
