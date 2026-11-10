import { z } from "zod";

export const analyzeSchema = z.object({
    mimeType: z.enum([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
        "application/pdf",
        "text/plain",
        "text/csv",
    ]),
    data: z.base64(),
});
