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
