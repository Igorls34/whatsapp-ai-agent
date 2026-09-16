import OpenAI from 'openai';
import { config } from '../config.js';

// Compatível com OpenAI e qualquer provedor com API compatível (Groq, Azure, Ollama...).
export function createOpenAiClient() {
  const options = {};
  if (config.openai.apiKey) options.apiKey = config.openai.apiKey;
  if (config.openai.baseURL) options.baseURL = config.openai.baseURL;

  if (!config.openai.apiKey && !config.openai.baseURL) {
    console.warn('[llm] OPENAI_API_KEY não definida. Configure o arquivo .env (veja .env.example).');
  }

  return new OpenAI(options);
}