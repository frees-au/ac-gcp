# Free Sauce ETL library for GCP

```
# From root of repo.
cd ac-etl/cloud-functions/email-nfe-warehouse

gcloud functions deploy hello-world --entry-point helloWorld --runtime nodejs18  --allow-unauthenticated --gen2 --trigger-topic=REDACTED

# Again from root.
cd ac-etl/cloud-functions/email-nfe-warehouse

gcloud functions deploy ac-email-processing --entry-point processEmails --runtime nodejs18  --gen2 --trigger-topic=REDACTED --env-vars-file .env.yaml
```
