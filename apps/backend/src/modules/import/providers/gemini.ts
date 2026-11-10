import {
    AiBusyError,
    PROMPT,
    RESPONSE_JSON_SCHEMA,
    type CoinExtractor,
} from "../extraction.js";

/**
 * The only file that knows Gemini exists.
 *
 * Gemini's responseSchema is an OpenAPI subset: no type arrays, `nullable`
 * instead. The shared schema uses plain JSON Schema, so it is translated here
 * and nowhere else.
 */

type Schema = { type?: unknown; [key: string]: unknown };

function toGemini(schema: unknown): unknown {
    if (Array.isArray(schema)) return schema.map(toGemini);
    if (typeof schema !== "object" || schema === null) return schema;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema as Schema)) {
        if (key === "type" && Array.isArray(value)) {
            out.type = value.find((t) => t !== "null");
            if (value.includes("null")) out.nullable = true;
        } else {
            out[key] = toGemini(value);
        }
    }
    return out;
}

const responseSchema = toGemini(RESPONSE_JSON_SCHEMA);

export function geminiExtractor(
    apiKey: string,
    model = "gemini-flash-latest",
): CoinExtractor {
    return async (file) => {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": apiKey,
                },
                // An overloaded model can hold the connection open for minutes. Past a
                // minute the person has given up anyway, so fail and let them retry.
                signal: AbortSignal.timeout(60_000),
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: PROMPT },
                                {
                                    inlineData: {
                                        mimeType: file.mimeType,
                                        data: file.data,
                                    },
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema,
                    },
                }),
            },
        );
        // 429 and 503 are Gemini saying "not now", not "not this file".
        if (response.status === 429 || response.status === 503) {
            throw new AiBusyError(`gemini answered ${response.status}`);
        }
        if (!response.ok) throw new Error(`gemini answered ${response.status}`);

        const body = (await response.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== "string")
            throw new Error("gemini returned no text");
        return JSON.parse(text);
    };
}
