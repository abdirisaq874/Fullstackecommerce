/**
 * Shipping RTK Query endpoint slice for seller-portal-v2.
 *
 * Mirrors the NestJS `ShippingController` (Phase 2 F4) seller-scoped endpoints:
 *   GET    /shipping/zones
 *   POST   /shipping/zones
 *   PATCH  /shipping/zones/:id
 *   DELETE /shipping/zones/:id                  (soft-delete; cascades to rates)
 *   GET    /shipping/zones/:zoneId/rates
 *   POST   /shipping/zones/:zoneId/rates
 *   PATCH  /shipping/zones/:zoneId/rates/:rateId
 *   DELETE /shipping/zones/:zoneId/rates/:rateId
 *
 * Response envelope ({ success, data, ... }) is stripped per-endpoint via
 * `unwrapEnvelope`. All endpoints share the single `ShippingZone` cache tag
 * (reserved in base-api.ts) — rate mutations invalidate the parent zone
 * entity so the rates list refetches without us needing a second tag type.
 */
import { baseApi, unwrapEnvelope } from './base-api';
import type { ResponseEnvelope } from './base-api';

// --- domain types (mirror backend CreateZoneDto / CreateRateDto) ------------

/**
 * A shipping zone as returned by the backend. The backend stores documents
 * under MongoDB so the canonical id field is `_id`; some controllers also
 * project a string `id`. We accept both and let consumers prefer `_id`.
 */
export interface ShippingZone {
  _id: string;
  id?: string;
  name: string;
  countries: string[];
  active: boolean;
  leadTimeDays: number;
  sellerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShippingRate {
  _id: string;
  id?: string;
  zoneId: string;
  method: string;
  baseCostCents: number;
  perItemCostCents: number;
  perKgCostCents: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateZoneBody {
  name: string;
  countries: string[];
  active?: boolean;
  leadTimeDays?: number;
}

export type UpdateZoneBody = Partial<CreateZoneBody>;

export interface CreateRateBody {
  method: string;
  baseCostCents: number;
  perItemCostCents?: number;
  perKgCostCents?: number;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  active?: boolean;
}

export type UpdateRateBody = Partial<CreateRateBody>;

// --- endpoint slice ---------------------------------------------------------

/** Normalise a backend zone doc so `_id` is always a string. */
function normaliseZone(doc: ShippingZone): ShippingZone {
  return { ...doc, _id: String(doc._id ?? doc.id ?? '') };
}

function normaliseRate(doc: ShippingRate): ShippingRate {
  return { ...doc, _id: String(doc._id ?? doc.id ?? '') };
}

export const shippingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Zones ───
    listZones: builder.query<ShippingZone[], void>({
      query: () => ({ url: '/shipping/zones', method: 'GET' }),
      transformResponse: (res: ResponseEnvelope<ShippingZone[]> | ShippingZone[]) => {
        const docs = unwrapEnvelope<ShippingZone[]>(res) ?? [];
        return docs.map(normaliseZone);
      },
      providesTags: (result) =>
        result
          ? [
              { type: 'ShippingZone', id: 'LIST' },
              ...result.map((z) => ({ type: 'ShippingZone' as const, id: z._id })),
            ]
          : [{ type: 'ShippingZone', id: 'LIST' }],
    }),

    createZone: builder.mutation<ShippingZone, CreateZoneBody>({
      query: (body) => ({ url: '/shipping/zones', method: 'POST', body }),
      transformResponse: (res: ResponseEnvelope<ShippingZone> | ShippingZone) =>
        normaliseZone(unwrapEnvelope<ShippingZone>(res)),
      invalidatesTags: [{ type: 'ShippingZone', id: 'LIST' }],
    }),

    updateZone: builder.mutation<ShippingZone, { id: string; patch: UpdateZoneBody }>({
      query: ({ id, patch }) => ({
        url: `/shipping/zones/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      transformResponse: (res: ResponseEnvelope<ShippingZone> | ShippingZone) =>
        normaliseZone(unwrapEnvelope<ShippingZone>(res)),
      invalidatesTags: (_, __, { id }) => [
        { type: 'ShippingZone', id },
        { type: 'ShippingZone', id: 'LIST' },
      ],
    }),

    deleteZone: builder.mutation<void, string>({
      query: (id) => ({ url: `/shipping/zones/${id}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: (_, __, id) => [
        { type: 'ShippingZone', id },
        { type: 'ShippingZone', id: 'LIST' },
      ],
    }),

    // ─── Rates ───
    listRatesForZone: builder.query<ShippingRate[], string>({
      query: (zoneId) => ({
        url: `/shipping/zones/${zoneId}/rates`,
        method: 'GET',
      }),
      transformResponse: (res: ResponseEnvelope<ShippingRate[]> | ShippingRate[]) => {
        const docs = unwrapEnvelope<ShippingRate[]>(res) ?? [];
        return docs.map(normaliseRate);
      },
      providesTags: (result, _err, zoneId) =>
        result
          ? [
              { type: 'ShippingZone', id: `RATES:${zoneId}` },
              ...result.map((r) => ({ type: 'ShippingZone' as const, id: `RATE:${r._id}` })),
            ]
          : [{ type: 'ShippingZone', id: `RATES:${zoneId}` }],
    }),

    createRate: builder.mutation<ShippingRate, { zoneId: string; body: CreateRateBody }>({
      query: ({ zoneId, body }) => ({
        url: `/shipping/zones/${zoneId}/rates`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: ResponseEnvelope<ShippingRate> | ShippingRate) =>
        normaliseRate(unwrapEnvelope<ShippingRate>(res)),
      invalidatesTags: (_, __, { zoneId }) => [
        { type: 'ShippingZone', id: `RATES:${zoneId}` },
        { type: 'ShippingZone', id: zoneId },
      ],
    }),

    updateRate: builder.mutation<ShippingRate, { zoneId: string; rateId: string; patch: UpdateRateBody }>({
      query: ({ zoneId, rateId, patch }) => ({
        url: `/shipping/zones/${zoneId}/rates/${rateId}`,
        method: 'PATCH',
        body: patch,
      }),
      transformResponse: (res: ResponseEnvelope<ShippingRate> | ShippingRate) =>
        normaliseRate(unwrapEnvelope<ShippingRate>(res)),
      invalidatesTags: (_, __, { zoneId, rateId }) => [
        { type: 'ShippingZone', id: `RATES:${zoneId}` },
        { type: 'ShippingZone', id: `RATE:${rateId}` },
      ],
    }),

    deleteRate: builder.mutation<void, { zoneId: string; rateId: string }>({
      query: ({ zoneId, rateId }) => ({
        url: `/shipping/zones/${zoneId}/rates/${rateId}`,
        method: 'DELETE',
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_, __, { zoneId, rateId }) => [
        { type: 'ShippingZone', id: `RATES:${zoneId}` },
        { type: 'ShippingZone', id: `RATE:${rateId}` },
      ],
    }),
  }),
});

export const {
  useListZonesQuery,
  useCreateZoneMutation,
  useUpdateZoneMutation,
  useDeleteZoneMutation,
  useListRatesForZoneQuery,
  useCreateRateMutation,
  useUpdateRateMutation,
  useDeleteRateMutation,
} = shippingApi;
