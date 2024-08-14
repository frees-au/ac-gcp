# Email Processing Cloud Function

This is a Google Cloud function which is subscribed to a Pub/Sub topic. A watch
on a Gmail account triggers events to this topic.

Aussie Coffee email receives XML files (NFe documents) from suppliers. These are
harvested, invoice data sent to the Data Warehouse (BigQuery), and the XML files are stored in a Storage Cloud bucket.

![Data Flow](https://raw.githubusercontent.com/frees-au/ac-gcp/main/ac-etl/cloud-functions/email-nfe-warehouse/data-flow.png)

NFe stands for “Nota Fiscal Eletrônica,” which is an electronic invoice used in Brazil. NFe (XML) files coming in via email is a really good source of truth, since even the smallest suppliers are able to provide these XML files and are obligated by law.

The process is scaled around a small business (a few XML files per day). Some improvements would be done around batching at larger scales. Otherwise it's fairly
efficient, XML files are usually less than 100kb, and the Cloud Function is only triggered when an email is received, etc.

This is not an accounting package nor designed to store NFe documents in their entirety. The purpose of the Data Warehouse is for trend analysis, auditing and later RAG/ML. So we tolerate that data might not be complete, eg. we might be missing some XML files or mis-processed some. We can improve and iterate on it.

The process is roughly:

  * Load messages with a specific Gmail label eg. "in-the-queue".
  * Load XML attachments
  * Parse them, determine if they are actually Brazilian NFe documents
  * Update BigQuery with the invoice data
  * Save the XML in a Storage Cloud bucket
  * Remove the label.

It is an idempotent process. If an email is relabelled for processing, or the supplier sends duplicate XML files, the data will be replaced.

Rough setup (also @see .env.yaml.example).

  * Pub/Sub Topic for "email processing"
  * Add a watch on Gmail, (@see /python-scripts) to send an event to this topic
  * Secrets for the service accounts needed.
  * Delegate perms to the Gmail service account domain wide in Google WorkSpace
  * BigQuery table/schemas for"nfe-received-xml" and "nfe-received-xml-lines"
  * Copy .env.yaml.example to .env.yaml and update values
  * Deploy the cloud function (below).

Example Cloud deployment

```
# From ac-etl/cloud-functions/email-nfe-warehouse

gcloud functions deploy ac-email-processing \
  --entry-point processEmails
  --runtime nodejs18
  --gen2
  --trigger-topic=your-topic-id
  --env-vars-file .env.yaml
  --max-instances=1
  --concurrency=1
```

Build locally (not needed to build in Cloud)

```
npx tsc
```
