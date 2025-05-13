import { serve } from "bun";
import index from "./index.html";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn(
    "🔴 GEMINI_API_KEY environment variable is not set. Transcription endpoint will not work."
  );
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
// For this PoC, we'll assume a model that can handle audio.
// You might need to adjust the model name based on availability and features.
// e.g., "gemini-2.0-flash-001" or other models that support audio input.
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" }) : null;

const generationConfig = {
  temperature: 0.7, // Adjust as needed
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048, // Adjust as needed
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];


const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/transcribe": {
      async POST(req) {
        let currentGenAI: GoogleGenerativeAI | null = null;
        let currentModel: any | null = null; // Consider a more specific type for the model

        const formData = await req.formData();
        const audioFile = formData.get("audio_file") as File | null;
        const clientToken = formData.get("gemini_api_token") as string | null;

        if (clientToken && clientToken.trim() !== "") {
          console.log("🔑 Using token provided by client for this request.");
          try {
            currentGenAI = new GoogleGenerativeAI(clientToken);
            // Ensure model name matches the global one or is configurable
            currentModel = currentGenAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
          } catch (e: any) {
            console.error("🔴 Error initializing Gemini with client-provided token:", e);
            return Response.json({ error: "Invalid client-provided API token.", details: e.message }, { status: 400 });
          }
        } else if (genAI && model) { // Fallback to server's key if available
          console.log("🔑 Client did not provide a token, using server's configured GEMINI_API_KEY.");
          currentGenAI = genAI;
          currentModel = model;
        } else {
          // This case means client didn't provide a token AND server key is not set up
          console.error("🔴 No API token provided by client and server's GEMINI_API_KEY is not configured or failed to initialize.");
          return Response.json({ error: "API token is required. Configure it on the server or provide it in the request." }, { status: 500 });
        }

        // Proceed with transcription using currentModel
        try {
          if (!audioFile) {
            console.warn("🟡 No audio file provided in request to /api/transcribe");
            return Response.json({ error: "No audio file provided." }, { status: 400 });
          }
          console.log(`🎙️ Received audio file: ${audioFile.name}, type: ${audioFile.type}, size: ${audioFile.size} bytes`);

          const audioBytes = await audioFile.arrayBuffer();
          const audioBuffer = Buffer.from(audioBytes);

          const audioPart = {
            inlineData: {
              data: audioBuffer.toString("base64"),
              mimeType: "audio/webm",
            },
          };

          const parts = [
            { text: "Please transcribe the following audio:" },
            audioPart,
          ];
          
          console.log(`🗣️ Sending audio to Gemini for transcription with MIME type: ${audioPart.inlineData.mimeType}...`);
          const result = await currentModel.generateContent({ // Use currentModel
            contents: [{ role: "user", parts }],
            generationConfig, // Re-use global config
            safetySettings,   // Re-use global config
          });

          const response = result.response;
          const transcribedText = response.text(); 
          console.log("✅ Transcription successful:", transcribedText);

          return Response.json({ transcription: transcribedText });
        } catch (error) {
          console.error("🔴 Error during transcription:", error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
          return Response.json({ error: "Failed to transcribe audio.", details: errorMessage }, { status: 500 });
        }
      },
    },

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production",
  port: process.env.PORT || 3000, // Added port configuration
});

console.log(`🚀 Server running at http://${server.hostname}:${server.port}`);
if (!GEMINI_API_KEY) {
  console.warn("🟡 Reminder: GEMINI_API_KEY is not set. /api/transcribe will not function correctly.");
}
