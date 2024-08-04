# Google Cloud stuff for Aussie Coffee by Free Sauce

Aussie Coffee is a cafe based in Rio de Janeiro. Free Sauce manages infrastructure
for this business in exchange for publicly sharing scripts and knowledge for learning purposes.

This code is automation for Aussie Coffee. It is not designed to be re-used by a different business. Any abstraction is just for ease of maintenance and to minimise
bus factor.

Code is copyright Simon Hobbs and Daniel Hobbs. It is licenced GPL2 so if you use or modify it you must attribute it. If you distribute the code you must include all source code. No warranty or support is provided, please use at your own risk.

Thanks!
Simon Hobbs (Free Sauce)
Daniel Hobbs (Aussie Coffee)

## Folders of interest

Usually you'll work from the context of the folders below - they generally don't have cross dependencies on other folders. Some may be moved to separate repositories
later.

## /python-scripts

Utility scripts. Eg. watch.py adds a watch on a gmail inbox.

## /ac-etl/cloud-functions/hello-world

This is a template cloud function built with TypeScript. It is set up to be able
to parse an incoming Google Pub/Sub event. Aussie Coffee automation generally
follows this pattern.

Example deployment:

```
gcloud functions deploy hello-world \
  --entry-point helloWorld
  --runtime nodejs18
  --gen2
--trigger-topic=some-topic
```

## /ac-etl/cloud-functions/email-nfe-warehouse

This is the Google Cloud function which is subscribed to the Pub/Sub topic. Aussie Coffee email receives XML files (NFe documents) from suppliers. These are
harvested, invoice data sent to the Data Warehouse (BigQuery), and the XML files are stored in a Storage Cloud bucket.

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

Rough notes and assumptions (more can be gleaned from .env.yaml.example).

  * Watch on Gmail, see python-scripts/watch.py
  * GCP Service Account that can interact with Gmail
  * GCP Service Account that can interact with Data Warehouse (bucket and BigQuery)
  * BigQuery table/schema should match the data being sent

Example deployment:

```
# From ac-etl/cloud-functions/email-nfe-warehouse

gcloud functions deploy ac-email-processing \
  --entry-point processEmails
  --runtime nodejs18
  --gen2
  --trigger-topic=your-topic-id
  --env-vars-file .env.yaml
```
