from google.oauth2 import service_account
from googleapiclient.discovery import build

# Load your service account credentials
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
SERVICE_ACCOUNT_FILE = 'service-account.json'

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

# Impersonate the user
delegated_credentials = credentials.with_subject('REDACTED@example.com')

# Build the Gmail service
service = build('gmail', 'v1', credentials=delegated_credentials)

# List all labels and their IDs for the impersonated user
results = service.users().labels().list(userId='me').execute()
labels = results.get('labels', [])

if not labels:
    print('No labels found.')
else:
    print('Labels:')
    for label in labels:
        print(f"{label['name']}: {label['id']}")
