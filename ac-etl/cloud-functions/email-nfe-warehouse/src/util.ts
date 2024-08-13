import assert from 'assert';
import * as Bq from './bigquery';
import { WebClient as SlackWebClient } from '@slack/web-api';

let slack: SlackWebClient | undefined;

function isIterable<T>(obj: any): obj is Iterable<T> {
  return obj != undefined && obj != null && typeof obj[Symbol.iterator] === 'function';
}

export function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value !== undefined) {
    return value;
  }
  else if (defaultValue !== undefined) {
    return defaultValue;
  }
  else {
    throw new Error(`Environment variable ${name} is not set and no default value was provided.`);
  }
}

export async function socialiseIt(message: string): Promise<any> {
  try {
    if (!slack) {
      slack = new SlackWebClient(getEnv('SLACK_TOKEN'));
    }
    const result = await slack.chat.postMessage({
      text: message,
      channel: getEnv('SLACK_CHANNEL'),
    });
  }
  catch (error) {
    console.log(error);
  }
}

/**
 * A sortable numeric batch ID that is easy for me to humanly parse, group records together and is used to identify older duplicates.
 *
 * @returns YYYYDDMM.{SecondsPassedToday}
 */
export function getBatchSequence(): number {
  const now: Date = new Date();
  // Seconds passed.
  const startOfDay: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const secondsPassed: number = Math.floor((now.getTime() - startOfDay.getTime()) / 1000);
  // Date formatm
  const year: string = now.getFullYear().toString();
  const month: string = (now.getMonth() + 1).toString().padStart(2, '0');
  const day: string = now.getDate().toString().padStart(2, '0');
  return ((parseFloat(`${year}${month}${day}`) * 1e5) + secondsPassed) / 1e5;
}
