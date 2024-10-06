from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import dotenv_values

cfg = dotenv_values(".env")

print("With configuration:")
for key, value in cfg.items():
    print(f"{key}: {value}")

# Load your service account credentials
SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.readonly'
]
credentials = service_account.Credentials.from_service_account_file(
    cfg["GMAIL_SERVICE_ACCOUNT"], scopes=SCOPES)
delegated_credentials = credentials.with_subject(cfg["GMAIL_ACCOUNT_EMAIL"])
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
