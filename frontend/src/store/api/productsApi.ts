import { apiSlice } from "./apiSlice";
import type {
  Product, CreateProductRequest, ProductQueryParams,
  Category, Brand, PaginatedResponse,
} from "../../types";
import { toQueryString } from "../../lib/utils";

export const productsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Products ───
    searchProducts: builder.query<PaginatedResponse<Product>, ProductQueryParams>({
      query: (params) => `/products?${toQueryString(params)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ _id }) => ({ type: "Product" as const, id: _id })),
              { type: "Products", id: "LIST" },
            ]
          : [{ type: "Products", id: "LIST" }],
    }),

    getProduct: builder.query<Product, string>({
      query: (id) => `/products/${id}`,
      providesTags: (result, error, id) => [{ type: "Product", id }],
    }),

    getProductBySlug: builder.query<Product, string>({
      query: (slug) => `/products/${slug}`,
      providesTags: (result) =>
        result ? [{ type: "Product", id: result._id }] : [],
    }),

    getFeaturedProducts: builder.query<Product[], number | void>({
      query: (limit = 12) => `/products/featured?limit=${limit}`,
      providesTags: [{ type: "Products", id: "FEATURED" }],
    }),

    createProduct: builder.mutation<Product, CreateProductRequest>({
      query: (data) => ({
        url: "/products",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [{ type: "Products", id: "LIST" }],
    }),

    updateProduct: builder.mutation<Product, { id: string; data: Partial<CreateProductRequest> }>({
      query: ({ id, data }) => ({
        url: `/products/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Product", id },
        { type: "Products", id: "LIST" },
      ],
    }),

    archiveProduct: builder.mutation<Product, string>({
      query: (id) => ({
        url: `/products/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Product", id },
        { type: "Products", id: "LIST" },
      ],
    }),

    // ─── Categories ───
    getCategoryTree: builder.query<Category[], void>({
      query: () => "/categories",
      providesTags: ["Categories"],
    }),

    createCategory: builder.mutation<Category, { name: string; parentId?: string; description?: string }>({
      query: (data) => ({
        url: "/categories",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Categories"],
    }),

    // ─── Brands ───
    getBrands: builder.query<Brand[], void>({
      query: () => "/brands",
      providesTags: ["Brands"],
    }),

    createBrand: builder.mutation<Brand, { name: string; logoUrl?: string }>({
      query: (data) => ({
        url: "/brands",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Brands"],
    }),
  }),
});

export const {
  useSearchProductsQuery,
  useGetProductQuery,
  useGetProductBySlugQuery,
  useGetFeaturedProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useArchiveProductMutation,
  useGetCategoryTreeQuery,
  useCreateCategoryMutation,
  useGetBrandsQuery,
  useCreateBrandMutation,
} = productsApi;
