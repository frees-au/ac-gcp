import * as ff from '@google-cloud/functions-framework';
import { MessagePublishedData } from '@google/events/cloud/pubsub/v1/MessagePublishedData';

async function helloWorld(cloudEvent: any): Promise<void> {
  let pubsub: MessagePublishedData = cloudEvent.data ?? null;
  if (!pubsub || !pubsub?.message?.data) {
    console.log('Unexpected data passed to cloud function.');
    return;
  }

  const message = JSON.parse(Buffer.from(pubsub.message.data, 'base64').toString());
  console.log(message);
}

ff.cloudEvent('helloWorld', helloWorld);
export { helloWorld };
