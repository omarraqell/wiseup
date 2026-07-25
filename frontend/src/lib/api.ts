/**
 * API client for the WiseUp backend.
 * In development, proxies to localhost:4000. In production, uses NEXT_PUBLIC_API_URL.
 */

import { createClient } from "@/lib/supabase/client";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function getProductImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  const cleanPath = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${cleanPath.startsWith("/images/") ? API_BASE : ""}${cleanPath}`;
}

export interface Category {
  id: number;
  name_ar: string;
  name_en: string;
  slug: string;
  count: number;
}

export interface Product {
  code: string;
  name_ar: string;
  name_en: string | null;
  unit: string;
  price_jod?: number;
  image_url: string;
  is_active?: boolean;
  category_id: number | null;
  category: { name_ar: string; name_en: string; slug: string } | null;
}

export interface ProductsResponse {
  products: Product[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface ChatResponse {
  answer: string | null;
  products: Product[];
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function authHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

// ─── Categories ──────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const data = await fetchJSON<{ categories: Category[] }>(`${API_BASE}/api/categories`);
  return data.categories;
}

// ─── Products ────────────────────────────────────────────────────────

export async function getProducts(params?: {
  category_id?: number;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ProductsResponse> {
  const qs = new URLSearchParams();
  if (params?.category_id) qs.set("category_id", String(params.category_id));
  if (params?.search) qs.set("search", params.search);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  return fetchJSON<ProductsResponse>(`${API_BASE}/api/products${query}`, {
    headers: await authHeaders(),
  });
}

export async function getProduct(code: string): Promise<Product> {
  return fetchJSON<Product>(`${API_BASE}/api/products/${encodeURIComponent(code)}`, {
    headers: await authHeaders(),
  });
}

// ─── Chat ────────────────────────────────────────────────────────────

export async function askChat(params: {
  query: string;
  k?: number;
  generate?: boolean;
  session_id?: string;
}): Promise<ChatResponse> {
  return fetchJSON<ChatResponse>(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function resetChat(session_id: string): Promise<void> {
  await fetchJSON(`${API_BASE}/api/chat/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id }),
  });
}

// ─── Admin Dashboard ──────────────────────────────────────────────────

export interface AdminStats {
  products: {
    total: number;
    active: number;
    inactive: number;
  };
  categories: {
    total: number;
    distribution: { id: number; name_ar: string; name_en: string; count: number }[];
  };
  leads: {
    total: number;
    potential_value_jod: number;
    status_breakdown: { new: number; contacted: number; emailed: number };
  };
}

export interface AdminLead {
  id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  message: string | null;
  product_codes: string[];
  total_jod: number | null;
  status: string;
  created_at: string;
}

export interface AdminCategory {
  id: number;
  name_ar: string;
  name_en: string;
  slug: string;
  sort_order: number;
  count: number;
}

export async function promoteToAdmin(): Promise<{ message: string }> {
  return fetchJSON<{ message: string }>(`${API_BASE}/api/admin/make-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
  });
}

export async function getAdminStats(): Promise<AdminStats> {
  return fetchJSON<AdminStats>(`${API_BASE}/api/admin/stats`, {
    headers: await authHeaders(),
  });
}

export async function getAdminProducts(params?: {
  category_id?: number;
  search?: string;
  status?: "active" | "inactive";
  image?: "with" | "without";
  min_price?: number;
  max_price?: number;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<ProductsResponse> {
  const qs = new URLSearchParams();
  if (params?.category_id) qs.set("category_id", String(params.category_id));
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  if (params?.image) qs.set("image", params.image);
  if (params?.min_price !== undefined) qs.set("min_price", String(params.min_price));
  if (params?.max_price !== undefined) qs.set("max_price", String(params.max_price));
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  return fetchJSON<ProductsResponse>(`${API_BASE}/api/admin/products${query}`, {
    headers: await authHeaders(),
  });
}

export async function createAdminProduct(product: Partial<Product> & { is_active?: boolean, price_jod: number }): Promise<Product> {
  return fetchJSON<Product>(`${API_BASE}/api/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(product),
  });
}

export async function updateAdminProduct(code: string, product: Partial<Product> & { is_active?: boolean, price_jod?: number }): Promise<Product> {
  return fetchJSON<Product>(`${API_BASE}/api/admin/products/${encodeURIComponent(code)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(product),
  });
}

export async function deleteAdminProduct(code: string): Promise<{ message: string }> {
  return fetchJSON<{ message: string }>(`${API_BASE}/api/admin/products/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const res = await fetchJSON<{ categories: AdminCategory[] }>(`${API_BASE}/api/admin/categories`, {
    headers: await authHeaders(),
  });
  return res.categories;
}

export async function createAdminCategory(category: { name_ar: string; name_en: string; slug: string; sort_order: number }): Promise<AdminCategory> {
  return fetchJSON<AdminCategory>(`${API_BASE}/api/admin/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(category),
  });
}

export async function updateAdminCategory(id: number, category: { name_ar?: string; name_en?: string; slug?: string; sort_order?: number }): Promise<AdminCategory> {
  return fetchJSON<AdminCategory>(`${API_BASE}/api/admin/categories/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(category),
  });
}

export async function deleteAdminCategory(id: number): Promise<{ message: string }> {
  return fetchJSON<{ message: string }>(`${API_BASE}/api/admin/categories/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
}

export async function getAdminLeads(): Promise<AdminLead[]> {
  const res = await fetchJSON<{ leads: AdminLead[] }>(`${API_BASE}/api/admin/leads`, {
    headers: await authHeaders(),
  });
  return res.leads;
}

export async function updateAdminLeadStatus(id: number, status: string): Promise<AdminLead> {
  return fetchJSON<AdminLead>(`${API_BASE}/api/admin/leads/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ status }),
  });
}

export async function deleteAdminLead(id: number): Promise<{ message: string }> {
  return fetchJSON<{ message: string }>(`${API_BASE}/api/admin/leads/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
}
