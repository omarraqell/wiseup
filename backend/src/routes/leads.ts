/**
 * Leads API routes.
 *
 * POST /api/leads — submit a customer lead (product interest + contact info)
 * GET  /api/leads — list leads (admin use)
 */
import { Router } from "express";
import { prisma } from "../utils/prisma";
import { LeadCreateSchema } from "../utils/validators";
import { sendLeadEmail } from "../services/email.service";

export const leadsRouter = Router();

// Submit a new lead
leadsRouter.post("/", async (req, res, next) => {
  try {
    // Validate the incoming lead payload
    const validation = LeadCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: { message: validation.error.errors[0].message } });
    }

    const {
      customer_name,
      customer_phone,
      customer_email,
      message,
      product_codes,
      session_id,
    } = validation.data;

    const stringCodes = product_codes.map(String);

    // Retrieve requested products to compute totals and format emails
    const products = await prisma.product.findMany({
      where: { code: { in: stringCodes } },
    });

    if (products.length === 0) {
      return res.status(404).json({ error: { message: "None of the specified product codes were found in the catalog" } });
    }

    const totalJod = products.reduce((sum, p) => sum + Number(p.priceJod), 0);

    // Save lead record in PostgreSQL
    const lead = await prisma.lead.create({
      data: {
        customerName: customer_name,
        customerPhone: customer_phone || null,
        customerEmail: customer_email || null,
        message: message || null,
        productCodes: stringCodes,
        totalJod,
        sessionId: session_id || null,
      },
    });

    // Send SMTP email notification asynchronously (don't block HTTP response)
    const emailProducts = products.map((p) => ({
      name_ar: p.nameAr,
      code: p.code,
      unit: p.unit,
      price_jod: Number(p.priceJod),
    }));

    sendLeadEmail({
      customerName: customer_name,
      customerPhone: customer_phone,
      customerEmail: customer_email,
      message: message,
      products: emailProducts,
      totalJod,
    })
      .then(async () => {
        // Update lead status to 'emailed' once SMTP call succeeds
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "emailed" },
        });
      })
      .catch((err) => {
        console.error(`Failed to send lead email for lead ID ${lead.id}:`, err);
      });

    res.status(201).json({
      id: lead.id,
      status: lead.status,
      total_jod: totalJod,
      product_count: products.length,
    });
  } catch (err) {
    next(err);
  }
});

// List leads (admin)
leadsRouter.get("/", async (_req, res, next) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({
      leads: leads.map((l) => ({
        id: l.id,
        customer_name: l.customerName,
        customer_phone: l.customerPhone,
        customer_email: l.customerEmail,
        product_codes: l.productCodes,
        total_jod: l.totalJod ? Number(l.totalJod) : null,
        status: l.status,
        created_at: l.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});
