import { z } from "zod";

// Jordanian mobile format: starts with 077, 078, or 079, followed by 7 digits (10 digits total)
const jordanPhoneRegex = /^(077|078|079)\d{7}$/;

export const ChatReqSchema = z.object({
  query: z.string().min(1, "Query is required and cannot be empty"),
  k: z.number().int().min(1).max(100).optional().default(9),
  generate: z.boolean().optional().default(true),
  session_id: z.string().optional(),
});

export const ChatResetSchema = z.object({
  session_id: z.string().min(1, "session_id is required"),
});

export const LeadCreateSchema = z
  .object({
    customer_name: z.string().trim().min(1, "Name is required"),
    customer_phone: z
      .string()
      .trim()
      .refine((val) => val === "" || jordanPhoneRegex.test(val), {
        message: "Invalid phone: must be a Jordanian mobile number starting with 077, 078, or 079 (e.g. 0791234567)",
      })
      .optional(),
    customer_email: z
      .string()
      .trim()
      .email("Invalid email address format")
      .or(z.literal(""))
      .optional(),
    message: z.string().optional(),
    product_codes: z.array(z.union([z.string(), z.number()])).min(1, "At least one product code is required"),
    session_id: z.string().optional(),
  })
  .refine(
    (data) => {
      // Must provide either phone or email
      const phoneValid = data.customer_phone && data.customer_phone.trim() !== "";
      const emailValid = data.customer_email && data.customer_email.trim() !== "";
      return phoneValid || emailValid;
    },
    {
      message: "At least one contact method (phone number or email address) must be provided",
      path: ["customer_phone"], // Attach to phone field by default
    }
  );
