## Setup

## Local deployment
1. Create a `.env` file in the root of the application (based off the `example.env` file).

2. Install the dependencies.
```bash
npm install
```

3. Then run the following command to start the application.
```bash
npm run
```

```
aws cloudformation create-stack --stack-name vinted-bot-api --template-body file://template.yaml --capabilities CAPABILITY_NAMED_IAM --profile vintedbot
```

## Deployment

### Automated

Once you push to the `main` branch it should automatically deploy to AWS. However, if you want to do it automated follow the steps below.

### Manual

> **NOTE**: Make sure docker locally is running.

> **NOTE**: As of now, the domain is `api.vintedbot.co.uk`. You change this in the Dockerfile and the location in the `app.ts`.

1. Get your credentials from AWS to do the upload to ECR.

```bash
aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin 224164455438.dkr.ecr.eu-west-2.amazonaws.com
```

2. Build the container locally.
```bash
docker build -t vinted-bot/api .
```

3. Tag it for ECR.
```bash
docker tag vinted-bot/api:latest 224164455438.dkr.ecr.eu-west-2.amazonaws.com/vinted-bot/api:latest
```

4. Push the image.
```bash
docker push 224164455438.dkr.ecr.eu-west-2.amazonaws.com/vinted-bot/api:latest
```

