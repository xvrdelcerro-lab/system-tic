'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-report-with-llm.ts';
import '@/ai/flows/generate-invoice-with-llm.ts';
import '@/ai/flows/generate-waste-report-with-llm.ts';
