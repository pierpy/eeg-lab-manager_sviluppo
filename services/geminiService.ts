
import { GoogleGenAI } from "@google/genai";
import { Experiment, Session } from "../types";

/**
 * Service to interact with Google Gemini AI for EEG lab assistance.
 * Follows @google/genai coding guidelines.
 */

// Helper to get a fresh instance of GoogleGenAI
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Summarizes session parameters and notes.
 */
export const summarizeSessionData = async (session: Session) => {
  const ai = getAiClient();
  const prompt = `Summarize the following EEG session parameters and notes into a concise technical summary for a research report:
    Subject ID: ${session.subjectId}
    Date: ${session.date}
    Duration: ${session.durationMinutes} mins
    Sampling Rate: ${session.samplingRate} Hz
    Channels: ${session.channelCount}
    Notes: ${session.notes}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Use .text property as per guidelines
    return response.text || "No summary generated.";
  } catch (error) {
    console.error("AI summarization failed:", error);
    return "Could not generate summary at this time.";
  }
};

/**
 * Suggests protocols based on experiment details.
 */
export const suggestProtocols = async (experiment: Experiment) => {
  const ai = getAiClient();
  const prompt = `Based on this EEG experiment title and description, suggest 3 standard recording protocols or preprocessing steps:
    Title: ${experiment.title}
    Description: ${experiment.description}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Use .text property as per guidelines
    return response.text || "No protocols suggested.";
  } catch (error) {
    console.error("AI protocol suggestion failed:", error);
    return "Could not suggest protocols.";
  }
};
