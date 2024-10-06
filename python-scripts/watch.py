from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import dotenv_values

cfg = dotenv_values(".env")

print("With configuration:")
for key, value in cfg.items():
    print(f"{key}: {value}")

# Impersonate the user with scopess.
SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.readonly'
]
credentials = service_account.Credentials.from_service_account_file(
    cfg["GMAIL_SERVICE_ACCOUNT"], scopes=SCOPES)
delegated_credentials = credentials.with_subject(cfg["GMAIL_ACCOUNT_EMAIL"])
service = build('gmail', 'v1', credentials=delegated_credentials)

# Set up the watch for the label and topic.
request = {
    'labelIds': [cfg["GMAIL_QUEUE_LABEL"]],
    'labelFilterBehavior': 'include',
    'topicName': cfg["PUBSUB_TOPIC"]
}
response = service.users().watch(userId='me', body=request).execute()

print('Watch response:', response)
