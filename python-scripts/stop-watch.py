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

delegated_credentials = credentials.with_subject('REDACTED@example.com')

# Build the Gmail service
service = build('gmail', 'v1', credentials=delegated_credentials)

# Stop watching the mailbox
response = service.users().stop(userId='me').execute()

print('Watch stopped:', response)
