from google.oauth2 import service_account
from googleapiclient.discovery import build

# Load your service account credentials
SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.readonly'
]
SERVICE_ACCOUNT_FILE = 'service-account.json'

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

# Impersonate the user
delegated_credentials = credentials.with_subject('REDACTED@example.com')

# Build the Gmail service
service = build('gmail', 'v1', credentials=delegated_credentials)
# Use list-labels.py to list you label IDs.
label_id = 'LABEL_REDACTED'
# GCP Pub/Sub topic
topic_name = 'projects/PROJECT/topics/NAME'

# Set up the watch for the "ops-todo" label
request = {
    'labelIds': [label_id],
    'labelFilterBehavior': 'include',
    'topicName': topic_name
}
response = service.users().watch(userId='me', body=request).execute()

print('Watch response:', response)
