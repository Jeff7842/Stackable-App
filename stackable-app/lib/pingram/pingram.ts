import { Pingram } from 'pingram';

export const pingram = new Pingram({
  apiKey: process.env.PINGRAM_API_KEY!,
  baseUrl: process.env.PINGRAM_BASE_URL!,
});