import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';

// Guest carts live in Redis and are the path a shopper arriving from an ad takes
// before they have an account, so these cover the ways that path can silently
// lose a cart: the pre-existing storage shape, stock checks on a merged line,
// and the hand-off to a real account at login.
describe('CartService — guest carts', () => {
  const PRODUCT_ID = '507f1f77bcf86cd799439011';

  /** A simple (variant-less) product priced at 10 with 5 in stock. */
  const product = () => ({
    _id: { toString: () => PRODUCT_ID },
    status: 'active',
    name: 'Cable',
    basePrice: 10,
    stock: 5,
    variants: [],
    images: [{ url: 'https://img/1.jpg', isPrimary: true }],
  });

  const build = () => {
    const store: Record<string, any> = {};
    const redis = {
      getJson: jest.fn(async (k: string) => store[k]),
      setJson: jest.fn(async (k: string, v: any) => { store[k] = v; }),
      del: jest.fn(async (k: string) => { delete store[k]; }),
    };
    const productModel = {
      findById: jest.fn(async () => product()),
      find: jest.fn(async () => [product()]),
    };
    const userCart = { items: [] as any[], save: jest.fn(async () => undefined) };
    const cartModel: any = {
      findOne: jest.fn(async () => userCart),
      findOneAndUpdate: jest.fn(async () => userCart),
    };
    const svc = new CartService(
      cartModel,
      productModel as any,
      { find: jest.fn(async () => []) } as any,
      { checkStock: jest.fn(async () => 0) } as any, // untracked SKU → falls back to product.stock
      redis as any,
      { get: jest.fn(() => 7) } as any,
      { validateForCart: jest.fn() } as any,
    );
    return { svc, redis, store, cartModel, userCart, productModel };
  };

  it('reads the legacy bare-array Redis shape without dropping the cart', async () => {
    const { svc, store } = build();
    // Written by the previous implementation, before guest carts held a coupon.
    store['cart:g1'] = [
      { productId: PRODUCT_ID, variantSku: `simple:${PRODUCT_ID}`, quantity: 2, unitPrice: 10 },
    ];

    const cart: any = await svc.getCart(undefined, 'g1');
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
  });

  it('pulls a stale guest price forward to the current product price', async () => {
    const { svc, store } = build();
    store['cart:g1'] = {
      items: [{ productId: PRODUCT_ID, variantSku: `simple:${PRODUCT_ID}`, quantity: 1, unitPrice: 999 }],
    };

    const cart: any = await svc.getCart(undefined, 'g1');
    expect(cart.items[0].unitPrice).toBe(10); // not the 999 the guest cart held
  });

  it('rejects an add that would push an existing guest line past available stock', async () => {
    const { svc } = build();
    // stock is 5; 3 + 3 = 6
    await svc.addItem(undefined, 'g1', PRODUCT_ID, undefined, 3);
    await expect(svc.addItem(undefined, 'g1', PRODUCT_ID, undefined, 3)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accumulates quantity on the same guest line when stock allows', async () => {
    const { svc } = build();
    await svc.addItem(undefined, 'g1', PRODUCT_ID, undefined, 2);
    const cart: any = await svc.addItem(undefined, 'g1', PRODUCT_ID, undefined, 2);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(4);
  });

  it('folds the guest cart into the user cart at login and drops the guest copy', async () => {
    const { svc, store, redis, userCart } = build();
    store['cart:g1'] = {
      items: [{ productId: PRODUCT_ID, variantSku: `simple:${PRODUCT_ID}`, quantity: 2, unitPrice: 10 }],
    };

    await svc.mergeGuestCart('507f191e810c19729de860ea', 'g1');

    expect(userCart.items).toHaveLength(1);
    expect(userCart.items[0].quantity).toBe(2);
    expect(redis.del).toHaveBeenCalledWith('cart:g1');
    expect(store['cart:g1']).toBeUndefined();
  });

  it('clears the guest key even when the guest cart was empty', async () => {
    const { svc, redis } = build();
    await svc.mergeGuestCart('507f191e810c19729de860ea', 'g1');
    expect(redis.del).toHaveBeenCalledWith('cart:g1');
  });

  it('never touches Redis for a signed-in shopper', async () => {
    const { svc, redis } = build();
    await svc.addItem('507f191e810c19729de860ea', undefined, PRODUCT_ID, undefined, 1);
    expect(redis.setJson).not.toHaveBeenCalled();
  });
});
