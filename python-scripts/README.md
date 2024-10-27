These are rough OSX steps

## Setup

Add a service-account.json

Add .env with
```
GMAIL_SERVICE_ACCOUNT=service-account.json
GMAIL_QUEUE_LABEL=Label_1232453678902567487
GMAIL_ACCOUNT_EMAIL=some-gmail@example.com
PUBSUB_TOPIC="projects/PROJECT/topics/SUBSRIPTIONNAME"
```

Install python with homebrew

```
python3 -m venv venv
source ./venv/bin/activate
pip install -r requirements.lock
# python list-labels.py to see all labels
python watch.py
deactivate
```
