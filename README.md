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

@see README in that directory.
