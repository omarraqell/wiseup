"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import {
  getAdminStats,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  getAdminLeads,
  updateAdminLeadStatus,
  deleteAdminLead,
  AdminStats,
  AdminLead,
  AdminCategory
} from "@/lib/api";
import { Product } from "@/lib/api";

type Tab = "overview" | "products" | "categories" | "leads";
type ProductStatusFilter = "" | "active" | "inactive";
type ProductImageFilter = "" | "with" | "without";
type ProductSort = "code_asc" | "code_desc" | "price_asc" | "price_desc" | "name_asc" | "newest";

export default function AdminDashboardPage() {
  const { lang, dir, t } = useLanguage();
  const router = useRouter();
  
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  
  // General states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Products states
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState<number | "">("");
  const [productStatusFilter, setProductStatusFilter] = useState<ProductStatusFilter>("");
  const [productImageFilter, setProductImageFilter] = useState<ProductImageFilter>("");
  const [productMinPrice, setProductMinPrice] = useState("");
  const [productMaxPrice, setProductMaxPrice] = useState("");
  const [productSort, setProductSort] = useState<ProductSort>("code_asc");
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productTotalCount, setProductTotalCount] = useState(0);
  
  // Product Edit/Create Modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    code: "",
    name_ar: "",
    name_en: "",
    unit: "pcs",
    price_jod: 0,
    category_id: "",
    image_url: "",
    is_active: true
  });
  
  // Categories states
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  
  // Category Modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name_ar: "",
    name_en: "",
    slug: "",
    sort_order: 0
  });

  // Leads states
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // General Notification state
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Authenticate user & role check
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/admin/login");
        return;
      }
      
      const sessionUser = session.user;
      const role = sessionUser?.user_metadata?.role || sessionUser?.user_metadata?.user_metadata?.role;
      
      if (role !== "admin") {
        router.push("/admin/login");
        return;
      }
      
      setUser(sessionUser);
      setAuthLoading(false);
    }
    
    checkAuth();
  }, [router]);

  // Load analytics & configurations on load
  useEffect(() => {
    if (!user) return;
    loadStats();
    loadCategories();
  }, [user]);

  // Handle auto-load products/leads when switching tabs or changing filters
  useEffect(() => {
    if (!user) return;
    if (activeTab === "products") {
      loadProducts();
    } else if (activeTab === "leads") {
      loadLeads();
    } else if (activeTab === "overview") {
      loadStats();
    }
  }, [activeTab, productPage, productCategoryFilter, productStatusFilter, productImageFilter, productMinPrice, productMaxPrice, productSort]);

  // Trigger search on delay
  useEffect(() => {
    if (activeTab !== "products" || !user) return;
    const timer = setTimeout(() => {
      setProductPage(1);
      loadProducts();
    }, 400);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err: any) {
      showNotification(err?.message || "Failed to load dashboard statistics", "error");
    } finally {
      setStatsLoading(false);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const response = await getAdminProducts({
        search: productSearch || undefined,
        category_id: productCategoryFilter || undefined,
        status: productStatusFilter || undefined,
        image: productImageFilter || undefined,
        min_price: productMinPrice ? Number(productMinPrice) : undefined,
        max_price: productMaxPrice ? Number(productMaxPrice) : undefined,
        sort: productSort,
        page: productPage,
        limit: 15
      });
      setProducts(response.products);
      setProductTotalPages(response.pagination.pages);
      setProductTotalCount(response.pagination.total);
    } catch (err: any) {
      showNotification(err?.message || "Failed to load products", "error");
    } finally {
      setProductsLoading(false);
    }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const data = await getAdminCategories();
      setCategories(data);
    } catch (err: any) {
      showNotification(err?.message || "Failed to load categories", "error");
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadLeads = async () => {
    setLeadsLoading(true);
    try {
      const data = await getAdminLeads();
      setLeads(data);
    } catch (err: any) {
      showNotification(err?.message || "Failed to load customer leads", "error");
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const resetProductFilters = () => {
    setProductSearch("");
    setProductCategoryFilter("");
    setProductStatusFilter("");
    setProductImageFilter("");
    setProductMinPrice("");
    setProductMaxPrice("");
    setProductSort("code_asc");
    setProductPage(1);
  };

  const activeProductRate = stats?.products.total
    ? Math.round((stats.products.active / stats.products.total) * 100)
    : 0;
  const contactedLeadRate = stats?.leads.total
    ? Math.round((stats.leads.status_breakdown.contacted / stats.leads.total) * 100)
    : 0;
  const topCategories = stats
    ? [...stats.categories.distribution].sort((a, b) => b.count - a.count).slice(0, 5)
    : [];
  const filteredCategories = categories.filter((c) => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return true;
    return (
      c.name_ar.toLowerCase().includes(query) ||
      c.name_en.toLowerCase().includes(query) ||
      c.slug.toLowerCase().includes(query) ||
      String(c.id).includes(query)
    );
  });

  // ─── PRODUCT ACTIONS ───
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      code: "",
      name_ar: "",
      name_en: "",
      unit: "pcs",
      price_jod: 0,
      category_id: categories[0]?.id ? String(categories[0].id) : "",
      image_url: "",
      is_active: true
    });
    setProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      code: product.code,
      name_ar: product.name_ar,
      name_en: product.name_en || "",
      unit: product.unit || "pcs",
      price_jod: product.price_jod !== undefined ? Number(product.price_jod) : 0,
      category_id: product.category_id ? String(product.category_id) : "",
      image_url: product.image_url || "",
      is_active: product.is_active !== false
    });
    setProductModalOpen(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        code: productForm.code,
        name_ar: productForm.name_ar,
        name_en: productForm.name_en || undefined,
        unit: productForm.unit,
        price_jod: Number(productForm.price_jod),
        category_id: productForm.category_id ? parseInt(productForm.category_id, 10) : undefined,
        image_url: productForm.image_url || undefined,
        is_active: productForm.is_active
      };

      if (editingProduct) {
        await updateAdminProduct(editingProduct.code, payload);
        showNotification("Product updated successfully!");
      } else {
        await createAdminProduct(payload);
        showNotification("Product created successfully!");
      }
      setProductModalOpen(false);
      loadProducts();
      loadStats();
    } catch (err: any) {
      showNotification(err?.message || "Failed to save product", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteProduct = async (code: string) => {
    if (!confirm(`Are you sure you want to delete product '${code}'?`)) return;
    setActionLoading(true);
    try {
      await deleteAdminProduct(code);
      showNotification("Product deleted successfully");
      loadProducts();
      loadStats();
    } catch (err: any) {
      showNotification(err?.message || "Failed to delete product", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── CATEGORY ACTIONS ───
  const openAddCategoryModal = () => {
    setEditingCategory(null);
    setCategoryForm({
      name_ar: "",
      name_en: "",
      slug: "",
      sort_order: categories.length + 1
    });
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: AdminCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name_ar: cat.name_ar,
      name_en: cat.name_en,
      slug: cat.slug,
      sort_order: cat.sort_order
    });
    setCategoryModalOpen(true);
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        name_ar: categoryForm.name_ar,
        name_en: categoryForm.name_en,
        slug: categoryForm.slug,
        sort_order: Number(categoryForm.sort_order)
      };

      if (editingCategory) {
        await updateAdminCategory(editingCategory.id, payload);
        showNotification("Category updated successfully!");
      } else {
        await createAdminCategory(payload);
        showNotification("Category created successfully!");
      }
      setCategoryModalOpen(false);
      loadCategories();
      loadStats();
    } catch (err: any) {
      showNotification(err?.message || "Failed to save category", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteCategory = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete category '${name}'? This will disconnect products in this category.`)) return;
    setActionLoading(true);
    try {
      await deleteAdminCategory(id);
      showNotification("Category deleted successfully");
      loadCategories();
      loadStats();
    } catch (err: any) {
      showNotification(err?.message || "Failed to delete category", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── LEAD ACTIONS ───
  const updateLeadStatusAction = async (id: number, newStatus: string) => {
    setActionLoading(true);
    try {
      await updateAdminLeadStatus(id, newStatus);
      showNotification(`Lead status updated to ${newStatus}`);
      loadLeads();
      loadStats();
    } catch (err: any) {
      showNotification(err?.message || "Failed to update lead status", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteLeadAction = async (id: number) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    setActionLoading(true);
    try {
      await deleteAdminLead(id);
      showNotification("Lead deleted successfully");
      loadLeads();
      loadStats();
    } catch (err: any) {
      showNotification(err?.message || "Failed to delete lead", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f4f5f8] flex flex-col justify-center items-center gap-4 text-slate-800 relative overflow-hidden">
        <div className="p-8 rounded-2xl bg-white border border-slate-200/80 backdrop-blur-xl flex flex-col items-center gap-6 shadow-xl">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-brand-red rounded-full animate-spin shadow-[0_0_15px_rgba(230,6,22,0.15)]" />
          </div>
          <div className="space-y-1.5 text-center">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-800">WISEUP ADMIN</h2>
            <p className="text-xs text-slate-400 font-medium">Verifying credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-slate-800 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 md:sticky md:top-0 md:h-screen bg-[#0a0b10] border-b md:border-b-0 md:border-r border-white/[0.04] flex flex-col shrink-0 z-10 text-gray-400">
        {/* Brand Logo */}
        <div className="p-6 border-b border-white/[0.04] flex items-center justify-between">
          <Link href="/" className="font-[Oswald] text-2xl font-extrabold tracking-wider bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent group">
            WISE<span className="text-brand-red group-hover:text-brand-light transition-colors">UP</span> <span className="text-[10px] text-gray-500 font-sans tracking-widest font-bold align-middle ml-1">CONSOLE</span>
          </Link>
        </div>

        {/* User Info Card */}
        <div className="p-4 mx-4 my-6 bg-gradient-to-b from-white/[0.02] to-transparent border border-white/[0.03] rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-red/10 flex items-center justify-center border border-brand-red/20 text-brand-red font-bold text-sm uppercase shadow-[0_0_10px_rgba(230,6,22,0.15)] shrink-0">
            {user.email?.charAt(0) || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user.email}</p>
            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[8px] font-bold bg-brand-red/10 border border-brand-red/20 text-brand-red uppercase tracking-wider">
              Administrator
            </span>
          </div>
        </div>

        {/* Tab Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer relative group ${
              activeTab === "overview"
                ? "bg-white/[0.04] text-white border border-white/[0.04]"
                : "text-gray-400 hover:text-white hover:bg-white/[0.01] border border-transparent"
            }`}
          >
            {activeTab === "overview" && (
              <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-brand-red rounded-r-md" />
            )}
            <span className={`material-symbols-outlined text-lg transition-colors duration-300 ${activeTab === "overview" ? "text-brand-red" : "text-gray-500 group-hover:text-gray-300"}`}>dashboard</span>
            <span>{t("لوحة المعلومات", "Overview")}</span>
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer relative group ${
              activeTab === "products"
                ? "bg-white/[0.04] text-white border border-white/[0.04]"
                : "text-gray-400 hover:text-white hover:bg-white/[0.01] border border-transparent"
            }`}
          >
            {activeTab === "products" && (
              <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-brand-red rounded-r-md" />
            )}
            <span className={`material-symbols-outlined text-lg transition-colors duration-300 ${activeTab === "products" ? "text-brand-red" : "text-gray-500 group-hover:text-gray-300"}`}>construction</span>
            <span>{t("إدارة المنتجات", "Products")}</span>
          </button>

          <button
            onClick={() => setActiveTab("categories")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer relative group ${
              activeTab === "categories"
                ? "bg-white/[0.04] text-white border border-white/[0.04]"
                : "text-gray-400 hover:text-white hover:bg-white/[0.01] border border-transparent"
            }`}
          >
            {activeTab === "categories" && (
              <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-brand-red rounded-r-md" />
            )}
            <span className={`material-symbols-outlined text-lg transition-colors duration-300 ${activeTab === "categories" ? "text-brand-red" : "text-gray-500 group-hover:text-gray-300"}`}>category</span>
            <span>{t("الأقسام", "Categories")}</span>
          </button>

          <button
            onClick={() => setActiveTab("leads")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer relative group ${
              activeTab === "leads"
                ? "bg-white/[0.04] text-white border border-white/[0.04]"
                : "text-gray-400 hover:text-white hover:bg-white/[0.01] border border-transparent"
            }`}
          >
            {activeTab === "leads" && (
              <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-brand-red rounded-r-md" />
            )}
            <span className={`material-symbols-outlined text-lg transition-colors duration-300 ${activeTab === "leads" ? "text-brand-red" : "text-gray-500 group-hover:text-gray-300"}`}>contact_mail</span>
            <span>{t("الطلبات والمهتمين", "Leads & Inquiries")}</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/[0.04]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 hover:border-red-900/40 hover:bg-red-950/20 text-gray-400 hover:text-red-400 text-xs font-bold uppercase transition-all duration-300 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow min-w-0 relative bg-[#f4f5f8]">
        {/* Header Bar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 md:px-8 flex items-center justify-between shrink-0 z-10 sticky top-0">
          <div>
            <h1 className="text-md font-bold text-slate-800 capitalize">
              {activeTab === "overview" && "Dashboard Analytics"}
              {activeTab === "products" && "Product Catalog Manager"}
              {activeTab === "categories" && "Category Manager"}
              {activeTab === "leads" && "Lead Management Center"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 hover:text-slate-900 transition-all bg-slate-50 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              Live Site View
            </Link>
          </div>
        </header>

        {/* Main Panels */}
        <div className="p-6 md:p-8">
          {/* Notification Toast */}
          {notification && (
            <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in ${
              notification.type === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                : "bg-red-50 border-red-200 text-red-600"
            }`}>
              <span className="material-symbols-outlined">
                {notification.type === "success" ? "check_circle" : "error"}
              </span>
              <p className="text-sm font-semibold">{notification.message}</p>
            </div>
          )}

          {/* ────────────────── OVERVIEW TAB ────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-8 animate-fade-up">
              {statsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-white border border-slate-200/80 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : stats ? (
                <>
                  <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Live Operations Overview
                        </div>
                        <div>
                          <h2 className="text-2xl font-[Oswald] font-extrabold text-slate-900 tracking-wide">Management Summary</h2>
                          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                            Monitor catalog health, customer demand, and category coverage from one operational view.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:min-w-[420px]">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Rate</p>
                          <p className="text-xl font-[Oswald] font-bold text-slate-900">{activeProductRate}%</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Lead Close Rate</p>
                          <p className="text-xl font-[Oswald] font-bold text-slate-900">{contactedLeadRate}%</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 col-span-2 sm:col-span-1">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Top Category</p>
                          <p className="text-sm font-bold text-slate-900 truncate mt-1">
                            {topCategories[0]?.name_en || topCategories[0]?.name_ar || "No categories"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Card 1: Pipeline Value */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-brand-red/20 hover:shadow-[0_8px_30px_rgba(230,6,22,0.04)] transition-all duration-300 hover:-translate-y-1">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-brand-red/5 to-transparent rounded-bl-full translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-300" />
                      <div className="w-10 h-10 rounded-xl bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red group-hover:bg-brand-red group-hover:text-white transition-all duration-300">
                        <span className="material-symbols-outlined text-lg">monetization_on</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Potential Sales Pipeline</p>
                        <h3 className="text-2xl font-[Oswald] font-extrabold text-slate-900 mt-1 tracking-wide">
                          {stats.leads.potential_value_jod.toLocaleString()} <span className="text-xs text-brand-red font-sans font-medium">JOD</span>
                        </h3>
                      </div>
                    </div>

                    {/* Card 2: Total Leads */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-blue-500/20 hover:shadow-[0_8px_30px_rgba(59,130,246,0.04)] transition-all duration-300 hover:-translate-y-1">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-transparent rounded-bl-full translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-300" />
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                        <span className="material-symbols-outlined text-lg">contact_phone</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Customer Leads</p>
                        <h3 className="text-2xl font-[Oswald] font-extrabold text-slate-900 mt-1 tracking-wide">
                          {stats.leads.total} <span className="text-xs text-blue-600 font-sans font-medium">leads</span>
                        </h3>
                      </div>
                    </div>

                    {/* Card 3: Active Products */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-emerald-500/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.04)] transition-all duration-300 hover:-translate-y-1">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-bl-full translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-300" />
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                        <span className="material-symbols-outlined text-lg">inventory_2</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Catalog Products</p>
                        <h3 className="text-2xl font-[Oswald] font-extrabold text-slate-900 mt-1 tracking-wide">
                          {stats.products.active} <span className="text-xs text-emerald-600 font-sans font-medium">/ {stats.products.total}</span>
                        </h3>
                      </div>
                    </div>

                    {/* Card 4: Total Categories */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-amber-500/20 hover:shadow-[0_8px_30px_rgba(245,158,11,0.04)] transition-all duration-300 hover:-translate-y-1">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/5 to-transparent rounded-bl-full translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-300" />
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                        <span className="material-symbols-outlined text-lg">grid_view</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Product Categories</p>
                        <h3 className="text-2xl font-[Oswald] font-extrabold text-slate-900 mt-1 tracking-wide">
                          {stats.categories.total} <span className="text-xs text-amber-600 font-sans font-medium">categories</span>
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Catalog Readiness</h4>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                          {stats.products.active} live
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${activeProductRate}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] font-semibold text-slate-500 mt-3">
                        <span>{stats.products.inactive} inactive</span>
                        <span>{stats.products.total} total products</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lead Follow-up</h4>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                          {stats.leads.status_breakdown.new} new
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                          <p className="text-lg font-[Oswald] font-bold text-blue-700">{stats.leads.status_breakdown.new}</p>
                          <p className="text-[10px] font-semibold text-blue-600">New</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                          <p className="text-lg font-[Oswald] font-bold text-amber-700">{stats.leads.status_breakdown.emailed}</p>
                          <p className="text-[10px] font-semibold text-amber-700">Emailed</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                          <p className="text-lg font-[Oswald] font-bold text-emerald-700">{stats.leads.status_breakdown.contacted}</p>
                          <p className="text-[10px] font-semibold text-emerald-700">Contacted</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Category Leaders</h4>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                          Top 5
                        </span>
                      </div>
                      <div className="space-y-2">
                        {topCategories.map((cat, index) => (
                          <div key={cat.id} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                                {index + 1}
                              </span>
                              <span className="font-semibold text-slate-700 truncate">{cat.name_en || cat.name_ar}</span>
                            </div>
                            <span className="font-[Oswald] font-bold text-slate-900">{cat.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Visual Charts & Breakdown Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Leads Status */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6">
                      <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-3 uppercase tracking-wider">Leads Pipeline Funnel</h4>
                      <div className="space-y-5">
                        {/* New */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold mb-1.5">
                            <span className="text-blue-600">New / Inbound</span>
                            <span className="text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-[10px]">{stats.leads.status_breakdown.new}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full" 
                              style={{ width: `${stats.leads.total > 0 ? (stats.leads.status_breakdown.new / stats.leads.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Emailed */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold mb-1.5">
                            <span className="text-amber-700">SMTP Notification Sent</span>
                            <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-[10px]">{stats.leads.status_breakdown.emailed}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" 
                              style={{ width: `${stats.leads.total > 0 ? (stats.leads.status_breakdown.emailed / stats.leads.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Contacted */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold mb-1.5">
                            <span className="text-emerald-600">Closed / Contacted</span>
                            <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[10px]">{stats.leads.status_breakdown.contacted}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" 
                              style={{ width: `${stats.leads.total > 0 ? (stats.leads.status_breakdown.contacted / stats.leads.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Products Distribution */}
                    <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6">
                      <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-3 uppercase tracking-wider">Products Per Category</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {stats.categories.distribution.map((dist) => (
                          <div key={dist.id} className="p-3.5 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-100 flex items-center justify-between transition-all">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{dist.name_en || dist.name_ar}</p>
                              <span className="text-[10px] text-slate-500 truncate block mt-0.5">{dist.name_ar}</span>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-[Oswald] text-xs font-bold shrink-0">
                              {dist.count} items
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-12 text-slate-400">No stats available. Check backend server.</div>
              )}
            </div>
          )}

          {/* ────────────────── PRODUCTS TAB ────────────────── */}
          {activeTab === "products" && (
            <div className="space-y-6 animate-fade-up">
              {/* Filter bar */}
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Product Filters</h3>
                    <p className="text-xs text-slate-500 mt-1">Narrow the catalog by status, category, image coverage, price, and sort order.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={resetProductFilters}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">restart_alt</span>
                      <span>Reset</span>
                    </button>
                    <button
                      onClick={openAddProductModal}
                      className="bg-gradient-to-r from-brand-red to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_12px_rgba(230,6,22,0.15)] hover:shadow-[0_6px_16px_rgba(230,6,22,0.25)] transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      <span>Add Product</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {/* Search */}
                  <div className="relative">
                    <span className="absolute left-3.5 top-9 text-slate-400 material-symbols-outlined text-lg">search</span>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search</label>
                    <input
                      type="text"
                      placeholder="Search by code or name..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                    />
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      value={productCategoryFilter}
                      onChange={(e) => {
                        setProductCategoryFilter(e.target.value ? Number(e.target.value) : "");
                        setProductPage(1);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                    >
                      <option value="" className="bg-white text-slate-800">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id} className="bg-white text-slate-800">
                          {c.name_en || c.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                    <select
                      value={productStatusFilter}
                      onChange={(e) => {
                        setProductStatusFilter(e.target.value as ProductStatusFilter);
                        setProductPage(1);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                    >
                      <option value="" className="bg-white text-slate-800">All Statuses</option>
                      <option value="active" className="bg-white text-slate-800">Active Products</option>
                      <option value="inactive" className="bg-white text-slate-800">Inactive Products</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Images</label>
                    <select
                      value={productImageFilter}
                      onChange={(e) => {
                        setProductImageFilter(e.target.value as ProductImageFilter);
                        setProductPage(1);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                    >
                      <option value="" className="bg-white text-slate-800">All Image States</option>
                      <option value="with" className="bg-white text-slate-800">With Image</option>
                      <option value="without" className="bg-white text-slate-800">Missing Image</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Min Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={productMinPrice}
                      onChange={(e) => {
                        setProductMinPrice(e.target.value);
                        setProductPage(1);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Max Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="999.00"
                      value={productMaxPrice}
                      onChange={(e) => {
                        setProductMaxPrice(e.target.value);
                        setProductPage(1);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sort By</label>
                    <select
                      value={productSort}
                      onChange={(e) => {
                        setProductSort(e.target.value as ProductSort);
                        setProductPage(1);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                    >
                      <option value="code_asc" className="bg-white text-slate-800">Code A-Z</option>
                      <option value="code_desc" className="bg-white text-slate-800">Code Z-A</option>
                      <option value="price_asc" className="bg-white text-slate-800">Price Low to High</option>
                      <option value="price_desc" className="bg-white text-slate-800">Price High to Low</option>
                      <option value="name_asc" className="bg-white text-slate-800">Name A-Z</option>
                      <option value="newest" className="bg-white text-slate-800">Newest First</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                {productsLoading ? (
                  <div className="p-16 flex flex-col justify-center items-center gap-3">
                    <div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" />
                    <p className="text-xs text-slate-400">Loading catalog products...</p>
                  </div>
                ) : products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/75 text-xs font-bold text-slate-600 uppercase tracking-wider">
                          <th className="p-4 w-16">Preview</th>
                          <th className="p-4">Code</th>
                          <th className="p-4">Name (Arabic)</th>
                          <th className="p-4">Name (English)</th>
                          <th className="p-4">Category</th>
                          <th className="p-4 text-right">Price (JOD)</th>
                          <th className="p-4 text-center">Status</th>
                          <th className="p-4 text-center w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {products.map((p) => (
                          <tr key={p.code} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors duration-200">
                            <td className="p-4">
                              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 overflow-hidden flex items-center justify-center relative shadow-inner group">
                                {p.image_url ? (
                                  <img 
                                    src={p.image_url.startsWith("http") ? p.image_url : `http://localhost:4000${p.image_url}`} 
                                    alt={p.code} 
                                    className="object-cover w-full h-full transform group-hover:scale-110 transition-transform duration-300"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "/placeholder-tool.png";
                                    }}
                                  />
                                ) : (
                                  <span className="material-symbols-outlined text-slate-400 text-lg">broken_image</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 text-brand-red shadow-sm">
                                {p.code}
                              </span>
                            </td>
                            <td className="p-4 font-semibold text-slate-800" dir="rtl">{p.name_ar}</td>
                            <td className="p-4 text-slate-500">{p.name_en || "—"}</td>
                            <td className="p-4 text-xs">
                              {p.category ? (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                                  {p.category.name_en || p.category.name_ar}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Uncategorized</span>
                              )}
                            </td>
                            <td className="p-4 text-right font-[Oswald] font-bold text-slate-800 text-base">
                              {p.price_jod !== undefined ? `${Number(p.price_jod).toFixed(2)} JOD` : "—"}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase ${
                                p.is_active !== false 
                                  ? "bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm" 
                                  : "bg-slate-100 border border-slate-200 text-slate-400"
                              }`}>
                                {p.is_active !== false ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openEditProductModal(p)}
                                  className="p-2 rounded-xl bg-slate-50 hover:bg-brand-red/10 text-slate-500 hover:text-brand-red border border-slate-200 hover:border-brand-red/20 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                                  title="Edit Product"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                <button
                                  onClick={() => deleteProduct(p.code)}
                                  className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                                  title="Delete Product"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-16 text-center text-slate-500">No products match your search or filter criteria.</div>
                )}
              </div>

              {/* Pagination */}
              {productTotalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center bg-white border border-slate-200/80 px-6 py-4 rounded-2xl text-xs font-semibold text-slate-500 gap-4 shadow-sm">
                  <span>Showing Page {productPage} of {productTotalPages} (Total {productTotalCount} items)</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                      disabled={productPage === 1}
                      className="px-4 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 transition-all duration-200 disabled:opacity-30 cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setProductPage((p) => Math.min(productTotalPages, p + 1))}
                      disabled={productPage === productTotalPages}
                      className="px-4 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 transition-all duration-200 disabled:opacity-30 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ────────────────── CATEGORIES TAB ────────────────── */}
          {activeTab === "categories" && (
            <div className="space-y-6 animate-fade-up">
              {/* Category Filter bar */}
              <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-end bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <div className="flex-1 max-w-xl">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search Categories</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-400 material-symbols-outlined text-lg">search</span>
                    <input
                      type="text"
                      placeholder="Search by name, slug, or ID..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Showing {filteredCategories.length} of {categories.length} categories
                  </p>
                </div>
                <button
                  onClick={openAddCategoryModal}
                  className="bg-gradient-to-r from-brand-red to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_12px_rgba(230,6,22,0.15)] hover:shadow-[0_6px_16px_rgba(230,6,22,0.25)] transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Add Category</span>
                </button>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                {categoriesLoading ? (
                  <div className="p-16 flex flex-col justify-center items-center gap-3">
                    <div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" />
                    <p className="text-xs text-slate-400">Loading categories...</p>
                  </div>
                ) : filteredCategories.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/75 text-xs font-bold text-slate-600 uppercase tracking-wider">
                          <th className="p-4 w-16">ID</th>
                          <th className="p-4">Name (Arabic)</th>
                          <th className="p-4">Name (English)</th>
                          <th className="p-4">Slug</th>
                          <th className="p-4 text-center">Sort Order</th>
                          <th className="p-4 text-center">Product Count</th>
                          <th className="p-4 text-center w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredCategories.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors duration-200">
                            <td className="p-4 font-mono text-slate-400 font-medium">#{c.id}</td>
                            <td className="p-4 font-semibold text-slate-800" dir="rtl">{c.name_ar}</td>
                            <td className="p-4 text-slate-500 font-medium">{c.name_en}</td>
                            <td className="p-4 font-mono text-xs">
                              <span className="px-2 py-1 rounded bg-amber-50 border border-amber-100 text-amber-700">
                                {c.slug}
                              </span>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-800 text-sm">{c.sort_order}</td>
                            <td className="p-4 text-center">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-[Oswald] font-bold text-xs">
                                {c.count} items
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openEditCategoryModal(c)}
                                  className="p-2 rounded-xl bg-slate-50 hover:bg-brand-red/10 text-slate-500 hover:text-brand-red border border-slate-200 hover:border-brand-red/20 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                                  title="Edit Category"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                <button
                                  onClick={() => deleteCategory(c.id, c.name_en || c.name_ar)}
                                  className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                                  title="Delete Category"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-16 text-center text-slate-400">
                    {categorySearch ? "No categories match your search." : "No categories found."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────────────── LEADS TAB ────────────────── */}
          {activeTab === "leads" && (
            <div className="space-y-6 animate-fade-up">
              {/* Leads grid */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                {leadsLoading ? (
                  <div className="p-16 flex flex-col justify-center items-center gap-3">
                    <div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" />
                    <p className="text-xs text-slate-400">Loading leads...</p>
                  </div>
                ) : leads.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/75 text-xs font-bold text-slate-600 uppercase tracking-wider">
                          <th className="p-4">Customer Info</th>
                          <th className="p-4">Requested Products</th>
                          <th className="p-4 text-right">Potential Value</th>
                          <th className="p-4 text-center">Status</th>
                          <th className="p-4 text-center">Received At</th>
                          <th className="p-4 text-center w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {leads.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors duration-200">
                            <td className="p-4 space-y-1.5">
                              <p className="font-bold text-slate-800 text-sm">{l.customer_name}</p>
                              <div className="flex flex-col gap-1">
                                {l.customer_phone && (
                                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px] text-slate-400">call</span>
                                    <span className="hover:text-slate-900 transition-colors">{l.customer_phone}</span>
                                  </p>
                                )}
                                {l.customer_email && (
                                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px] text-slate-400">mail</span>
                                    <span className="hover:text-slate-900 transition-colors">{l.customer_email}</span>
                                  </p>
                                )}
                              </div>
                              {l.message && (
                                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 max-w-sm mt-2 italic relative border-l-2 border-l-brand-red pl-3 pr-2 py-1.5">
                                  "{l.message}"
                                </p>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                {l.product_codes.map((code) => (
                                  <span key={code} className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-brand-red/5 border border-brand-red/10 text-brand-red shadow-sm">
                                    {code}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-4 text-right font-[Oswald] font-bold text-slate-800 text-base">
                              {l.total_jod ? `${l.total_jod.toFixed(2)} JOD` : "—"}
                            </td>
                            <td className="p-4 text-center">
                              <select
                                value={l.status}
                                onChange={(e) => updateLeadStatusAction(l.id, e.target.value)}
                                className={`text-[10px] font-extrabold uppercase rounded-lg px-3 py-1.5 border focus:outline-none cursor-pointer transition-all duration-300 ${
                                  l.status === "new"
                                    ? "bg-blue-50 border-blue-200 text-blue-600"
                                    : l.status === "emailed"
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-600"
                                }`}
                              >
                                <option value="new" className="bg-white text-blue-600">New</option>
                                <option value="emailed" className="bg-white text-amber-700">SMTP Sent</option>
                                <option value="contacted" className="bg-white text-emerald-600">Contacted</option>
                              </select>
                            </td>
                            <td className="p-4 text-center text-xs text-slate-400 font-medium">
                              {new Date(l.created_at).toLocaleString()}
                            </td>
                            <td className="p-4">
                              <div className="flex justify-center">
                                <button
                                  onClick={() => deleteLeadAction(l.id)}
                                  className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                                  title="Delete Lead"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-16 text-center text-slate-400">No leads received yet.</div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ────────────────── PRODUCT CREATION/EDITING MODAL ────────────────── */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-100/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 border border-slate-200 backdrop-blur-xl rounded-3xl w-full max-w-lg p-8 shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setProductModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all duration-200 material-symbols-outlined cursor-pointer"
            >
              close
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-6 pr-8">
              {editingProduct ? `Edit Product: ${editingProduct.code}` : "Add New Product"}
            </h3>
            
            <form onSubmit={saveProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WUP-909"
                    value={productForm.code}
                    disabled={!!editingProduct}
                    onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all disabled:opacity-50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Price (JOD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={productForm.price_jod}
                    onChange={(e) => setProductForm({ ...productForm, price_jod: parseFloat(e.target.value) || 0 })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Arabic Name *</label>
                <input
                  type="text"
                  required
                  placeholder="اسم المنتج باللغة العربية"
                  value={productForm.name_ar}
                  onChange={(e) => setProductForm({ ...productForm, name_ar: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all text-right"
                  dir="rtl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">English Name</label>
                <input
                  type="text"
                  placeholder="Product Name in English"
                  value={productForm.name_en}
                  onChange={(e) => setProductForm({ ...productForm, name_en: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unit (Unit of Measure)</label>
                  <input
                    type="text"
                    placeholder="pcs"
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category *</label>
                  <select
                    required
                    value={productForm.category_id}
                    onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_en || c.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Image URL (relative/absolute)</label>
                <input
                  type="text"
                  placeholder="/images/product-file-name.jpg"
                  value={productForm.image_url}
                  onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                />
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="productActiveCheckbox"
                  checked={productForm.is_active}
                  onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded accent-brand-red bg-white border-slate-300"
                />
                <label htmlFor="productActiveCheckbox" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  Is Product Active (Visible in Storefront & Chat recommendation)
                </label>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full bg-gradient-to-r from-brand-red to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shadow-[0_4px_12px_rgba(230,6,22,0.15)] hover:shadow-[0_6px_16px_rgba(230,6,22,0.25)] transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 mt-6"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>Save Product</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── CATEGORY CREATION/EDITING MODAL ────────────────── */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-100/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 border border-slate-200 backdrop-blur-xl rounded-3xl w-full max-w-md p-8 shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setCategoryModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all duration-200 material-symbols-outlined cursor-pointer"
            >
              close
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-6 pr-8">
              {editingCategory ? `Edit Category: ${editingCategory.name_en || editingCategory.name_ar}` : "Add New Category"}
            </h3>
            
            <form onSubmit={saveCategory} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Arabic Name *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: آلات ومعدات صناعية"
                  value={categoryForm.name_ar}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name_ar: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all text-right"
                  dir="rtl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">English Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Industrial Machines & Tools"
                  value={categoryForm.name_en}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name_en: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Slug (unique URL path) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. industrial-tools"
                    value={categoryForm.slug}
                    onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sort Order</label>
                  <input
                    type="number"
                    value={categoryForm.sort_order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value, 10) || 0 })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-red/40 focus:ring-1 focus:ring-brand-red/20 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full bg-gradient-to-r from-brand-red to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shadow-[0_4px_12px_rgba(230,6,22,0.15)] hover:shadow-[0_6px_16px_rgba(230,6,22,0.25)] transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 mt-6"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>Save Category</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
