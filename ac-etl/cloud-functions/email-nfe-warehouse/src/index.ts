import assert from 'assert';
import * as Ac from './util';
import * as Bq from './bigquery';
import * as Gm from './gmail';
import * as St from './storage';
import * as ff from '@google-cloud/functions-framework';
import { MessagePublishedData } from '@google/events/cloud/pubsub/v1/MessagePublishedData';
import NfeDocument, * as nfe from './nfe';
// import BigQuery from '@google-cloud/bigquery';
// import { isMemberName } from 'typescript';

async function processEmailXml(cloudEvent: any): Promise<void> {

  const batchSequence = Ac.getBatchSequence();
  const logId = batchSequence.toString().split('.')[1] || "0";
  const startTime = new Date();
  let suppliers: string[] = [];

  console.log(`${logId} Begin processing a trigger from Gmail.`);

  let pubsub: MessagePublishedData = cloudEvent.data ?? null;
  if (!pubsub || !pubsub?.message?.data) {
    console.log(['Unexpected data passed to cloud function:', cloudEvent]);
    return;
  }

  const message = JSON.parse(Buffer.from(pubsub.message.data, 'base64').toString());
  const historyId = message.historyId;
  // Ac.socialiseIt(`Email(s) were added to the ops queue (history ID: ${historyId})`);

  const [gmail, bucket] = await Promise.all([
    Gm.getGmailClient(),
    St.getBucket(Ac.getEnv('BUCKET_FOR_XML'))
  ]);

  const invoiceRows: Bq.InvoiceRecord[] = [];
  const invoiceLinesRows: Bq.InvoiceRecordLine[] = [];

  const messages = await Gm.getMessages(
    'has:attachment filename:xml',
    Ac.getEnv('GMAIL_LABEL_IN_QUEUE'),
  );

  if (message.length == 0) {
    console.log(`${logId}: Nothing found process, perhaps it recently ran.`);
  }

  // Keeping this basic and procedural while working out the kinks.
  for (const message of messages) {
    console.log(`${logId}: ${message.snippet}`);

    const currentTime = new Date();
    if ((startTime.getTime() - currentTime.getTime()) > 3e4) {
      // Only process for 30 seconds or so.
      continue;
    }

    if (message?.payload?.parts) {
      for (const part of message.payload.parts) {
        if (part?.body?.attachmentId && message.id) {
          const attachment = await gmail.users.messages.attachments.get({
            id: part.body.attachmentId,
            messageId: message.id,
            userId: 'me'
          });

          if (attachment?.data?.data && part?.filename) {
            try {
              if (!part.filename.endsWith('.xml')) {
                console.log(`${logId}/IGNORE: ${part.filename}`);
                continue;
              }
              const xml = Buffer.from(attachment.data.data, 'base64').toString();
              const nfeDocument = new NfeDocument(xml, part?.filename || 'a file');

              if (nfeDocument.isNfeValid()) {
                console.log(`${logId}/VALID: ${part.filename} is a/an ${nfeDocument.getType()} record for ${nfeDocument.getSupplierDisplayName()}`);
                invoiceRows.push({
                  nfeId: nfeDocument.getDocumentId(),
                  dateTime: nfeDocument.getDateTime(),
                  nfeType: nfeDocument.getType(),
                  supplierName: nfeDocument.getSupplierDisplayName(),
                  supplierId: nfeDocument.getSupplierId(),
                  invoiceNumber: nfeDocument.getInvoiceNumber(),
                  invoiceTotal: nfeDocument.getInvoiceTotal(),
                  description: nfeDocument.getInvoiceDescription(),
                  batchSequence: batchSequence
                })

                // @todo need to error handle this to send a slack message when issues. This email x@a.b has an issue!
                for (const line of nfeDocument.lineItems()) {
                  line.batchSequence = batchSequence;
                  invoiceLinesRows.push(line);
                }

                if (!suppliers.includes(nfeDocument.getSupplierDisplayName())) {
                  suppliers.push(nfeDocument.getSupplierDisplayName());
                }
              }
            }
            catch (error) {
              console.log([`${logId}/Error processing ${part.filename}`, error]);
            }
            // console.log(`${logId}/Finished: ${part.filename}`);
            // Ac.writeAttachmentToBucket(bucket, part.filename, 'application/xml', attachment.data.data);
          }
        }
      }
    }
  }

  if (invoiceRows.length > 0 || invoiceLinesRows.length > 0) {

    try {
      await Bq.insertInvoiceRecords(invoiceRows, invoiceLinesRows, logId);
    }
    catch (error) {
      console.log("There was an error inserting records.", error);
      Ac.socialiseIt(`There was an error inserting invoices to the data warehouse, data my be inaccurate for these suppliers: ${suppliers.join(", ")}`);
      return;
    }

    try {
      await Gm.updateMessageLabels(messages, Ac.getEnv('GMAIL_LABEL_IN_QUEUE'), Ac.getEnv('GMAIL_LABEL_DONE'));
    }
    catch (error) {
      console.log("There was an error updating labels.", error);
      Ac.socialiseIt(`There was an error updating \`ops/in-queue\` and :white_check_mark labels, which may cause period duplicate records for these suppliers: ${suppliers.join(", ")}`);
    }

    console.log(`${logId}: Completed processing ${messages.length} email(s).`);
    Ac.socialiseIt(`Processed ${messages.length} tagged email(s) and imported ${invoiceRows.length} NFe documents for these suppliers: ${suppliers.join(", ")}`);
  }
  else {
    console.log(`${logId}: Nothing found process.`);
  }
}

ff.cloudEvent('processEmailXml', processEmailXml);

export { processEmailXml };
