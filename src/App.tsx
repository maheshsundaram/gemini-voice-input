import { useState, useRef } from "react";
import "./index.css";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function App() {
  const [isListening, setIsListening] = useState(false);
  const [geminiApiToken, setGeminiApiToken] = useState("");
  const [transcribedText, setTranscribedText] = useState("");
  const [statusText, setStatusText] = useState("Click the button to start voice input.");
  const [errorText, setErrorText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const sendAudioForTranscription = async (audioFile: File) => {
    setStatusText("Transcribing audio...");
    setErrorText("");
    // We will append, so we don't clear transcribedText here anymore
    // setTranscribedText(""); 

    const formData = new FormData();
    formData.append("audio_file", audioFile, "recording.webm"); // filename can be anything
    if (geminiApiToken) {
      formData.append("gemini_api_token", geminiApiToken);
    }

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || "Transcription failed");
      }

      const newTranscription = result.transcription || "";
      if (newTranscription) {
        const timestamp = new Date().toLocaleTimeString();
        const newEntry = `[${timestamp}] ${newTranscription}`;
        setTranscribedText(prevText => 
          prevText 
            ? prevText + "\n" + newEntry 
            : newEntry
        );
      } else {
        // Handle case where transcription is empty but successful if needed
        // For now, just don't append anything.
      }
      setStatusText("Transcription complete. Click to start again.");
    } catch (err) {
      console.error("Transcription error:", err);
      const message = err instanceof Error ? err.message : "An unknown error occurred during transcription.";
      setErrorText(`Error: ${message}`);
      setStatusText("Error during transcription. Please try again.");
    }
  };

  const handleToggleListen = async () => {
    setErrorText("");
    if (isListening) {
      // Stop listening
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        // The onstop event handler will process and send the audio
      }
      setIsListening(false);
      // Status will be updated by onstop or sendAudioForTranscription
    } else {
      // Start listening
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = []; // Clear previous chunks

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          // Safari might record in audio/mp4, check mediaRecorderRef.current.mimeType if issues arise
          const audioFile = new File([audioBlob], "recording.webm", { type: audioBlob.type });
          sendAudioForTranscription(audioFile);
          
          // Clean up the stream tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsListening(true);
        // setTranscribedText(""); // Removed this line to allow appending across sessions
        setStatusText("Listening... Click to stop.");
      } catch (err) {
        console.error("Error accessing microphone:", err);
        const message = err instanceof Error ? err.message : "An unknown error occurred.";
        setErrorText(`Error accessing microphone: ${message}. Please ensure permission is granted.`);
        setStatusText("Could not start listening. Check microphone permissions.");
        setIsListening(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full text-center bg-gradient-to-br from-purple-600 via-blue-500 to-indigo-700">
      <Card className="bg-black/30 backdrop-blur-xl border-indigo-500/40 w-full max-w-2xl h-[85vh] shadow-2xl flex flex-col overflow-hidden m-4 flex-shrink-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold my-2 leading-tight text-indigo-100">
            Voice Input
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-4 flex-grow flex flex-col pb-6 overflow-y-auto">
          {/* API Token Section */}
          <div className="w-full space-y-1.5">
            <Label htmlFor="geminiApiToken" className="text-left block text-xs font-medium text-indigo-300">
              GEMINI API TOKEN
            </Label>
            <Input
              id="geminiApiToken"
              type="password"
              placeholder="Enter your Gemini API Token"
              value={geminiApiToken}
              onChange={(e) => setGeminiApiToken(e.target.value)}
              className="bg-black/20 placeholder:text-slate-400/70 border-indigo-500/50 text-slate-100 focus:ring-indigo-500"
            />
            <p className="text-xs text-indigo-300/80 text-left">
              Get your API key from{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-indigo-200"
              >
                Google AI Studio
              </a>.
            </p>
            <p className="text-xs text-indigo-300/80 text-left">
              Learn more about the{" "}
              <a
                href="https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-0-flash"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-indigo-200"
              >
                Gemini 2.0 Flash model
              </a>.
            </p>
          </div>

          {/* Controls Section */}
          <div className="flex flex-col items-center space-y-3 pt-2">
            <Button 
              onClick={handleToggleListen} 
              size="lg" 
              variant={isListening ? "destructive" : "default"} 
              className={`w-full max-w-xs shadow-md ${isListening ? '' : 'bg-indigo-500 hover:bg-indigo-600 text-indigo-50'}`}
            >
              {isListening ? "Stop Listening" : "Start Listening"}
            </Button>
            {isListening && (
              <div className="flex items-center space-x-2 text-red-500">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse-custom"></div>
                <span className="text-xs">Recording...</span>
              </div>
            )}
          </div>
          
          {/* Status/Error Message Area */}
          <div className="min-h-[20px] pt-1 text-center">
            {statusText && !errorText && <p className="text-xs text-slate-300">{statusText}</p>}
            {errorText && <p className="text-xs text-destructive font-medium">{errorText}</p>}
          </div>

          {/* Transcription Display Area */}
          <div className="mt-2 p-3 border border-indigo-500/30 rounded-md bg-black/20 shadow-inner flex-grow flex flex-col min-h-[200px] max-h-[calc(85vh-300px)]"> {/* Adjusted max-height */}
            <p className="text-xs text-indigo-200 sticky top-0 bg-slate-800/60 backdrop-blur-sm py-1 mb-1 z-10 border-b border-indigo-500/30 rounded-t-sm">Transcribed Text:</p>
            <div className="overflow-y-auto flex-grow">
              {transcribedText ? (
                <p className="text-sm whitespace-pre-wrap text-slate-100">{transcribedText}</p>
              ) : (
                <p className="text-sm whitespace-pre-wrap text-slate-400/60 italic flex-grow flex items-center justify-center">
                  Your transcribed text will appear here...
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
