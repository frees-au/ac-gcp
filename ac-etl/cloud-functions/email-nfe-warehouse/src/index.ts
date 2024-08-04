// https://gist.github.com/brauliodavid/3a80d2f4fbced8fdbbfe54232ae9fef4

import * as ff from '@google-cloud/functions-framework';
import { MessagePublishedData } from '@google/events/cloud/pubsub/v1/MessagePublishedData';
import * as Ac from './util';
import assert from 'assert';


async function processEmailXml(cloudEvent: any): Promise<void> {
  let pubsub: MessagePublishedData = cloudEvent.data ?? null;
  if (!pubsub || !pubsub?.message?.data) {
    console.log(['Unexpected data passed to cloud function:', cloudEvent]);
    return;
  }

  const message = JSON.parse(Buffer.from(pubsub.message.data, 'base64').toString());
  const historyId = message.historyId;
  // Ac.socialiseIt(`Email(s) were added to the ops queue (history ID: ${historyId})`);

  const [gmail, bucket] = await Promise.all([
    Ac.getGmailClient(),
    Ac.getBucket(Ac.getEnv('BUCKET_FOR_XML'))
  ]);

  const messages = await Ac.getMessages(
    'has:attachment filename:xml',
    Ac.getEnv('GMAIL_LABEL_IN_QUEUE'),
  );

  // Keeping this basic and procedural while working out the kinks.
  for (const message of messages) {
    if (message?.payload?.parts) {
      for (const part of message.payload.parts) {
        if (part?.body?.attachmentId && message.id) {
          const attachment = await gmail.users.messages.attachments.get({
            id: part.body.attachmentId,
            messageId: message.id,
            userId: 'me'
          });

          const stream = require('stream');
          const bufferStream = new stream.PassThrough();
          if (attachment?.data?.data) {
            bufferStream.end(Buffer.from(attachment.data.data, 'base64'));
          }

          console.log(part.filename);

          const file = bucket.file(part.filename);
//          const file = bucket.file('incoming/' + part.filename);
          bufferStream.pipe(file.createWriteStream({
              metadata: {
                contentType: 'application/xml',
                metadata: {
                  custom: 'metadata'
                }
              },
              public: false,
              validation: "md5"
            }))
            .on('error', function(error: any) {
              console.log(error);
            })
            .on('finish', function() {
              // The file upload is complete.
            });
        }
      }
    }
  };
}

ff.cloudEvent('processEmailXml', processEmailXml);

export { processEmailXml };
