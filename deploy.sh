#!/bin/bash

# deploy.sh file

# retrieve secret from AWS Secrets Manager
SECRET=$(aws secretsmanager get-secret-value --secret-id prod/plan-generator/openai)

# Extract "SecretString" from the JSON response
SecretString=$(jq -r '.SecretString' <<< "${SECRET}")

# Extract "SecretString.OPENAI_API_KEY" from the JSON response
OPENAI_API_KEY=$(jq -r '.OPENAI_API_KEY' <<< "${SecretString}")

# If the OPENAI_API_KEY is not set, exit with an error
if [ -z "${OPENAI_API_KEY}" ]; then
  echo "OPENAI_API_KEY is not set"
  exit 1
fi

# build
sam build

# deploy
sam deploy --parameter-overrides OpenAiApiKey=$OPENAI_API_KEY