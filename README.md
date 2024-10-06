## Setup

## Add to tempalte
Add the creation of the log group

## Domain
As of now, the domain is `shouldhavehttps.zapto.org`. You change this in the Dockerfile and the location in the `app.ts`.

Also change the API URL in the frontend.

### Create log group

```bash
aws logs create-log-group --log-group-name /ecs/vinted-bot-api --region eu-west-2
```

### Deploy
> **NOTE**: Make sure docker locally is running.

```bash
aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin 224164455438.dkr.ecr.eu-west-2.amazonaws.com
```

Build the container locally.
```bash
docker build -t vinted-bot/api .
```

Tag it for ECR.
```bash
docker tag vinted-bot/api:latest 224164455438.dkr.ecr.eu-west-2.amazonaws.com/vinted-bot/api:latest
```

Push the image.
```bash
docker push 224164455438.dkr.ecr.eu-west-2.amazonaws.com/vinted-bot/api:latest
```

