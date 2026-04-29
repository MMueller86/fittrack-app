# Azure Environment Notes

## Current Azure Preparation Status

The user has:
- Created an Azure account
- Set a monthly Azure budget of 150 USD on the company-backed account
- Created or has access to an Azure OpenAI resource
- Deployed an Azure OpenAI model successfully
- Verified the Azure OpenAI deployment with a local Python test call

## Existing Azure OpenAI Configuration

The app backend shall use Azure OpenAI through Azure Functions.

Required runtime configuration values:
- AZURE_OPENAI_ENDPOINT
- AZURE_OPENAI_API_KEY or Managed Identity / Key Vault based access later
- AZURE_OPENAI_API_VERSION
- AZURE_OPENAI_DEPLOYMENT_NAME

Known deployment:
- Deployment name: gpt4o-mini
- Model family: gpt-4o-mini
- Purpose: cost-efficient MVP AI workflows

Important:
- Do not put API keys into the React Native app.
- Do not commit API keys to Git.
- Backend must own all Azure OpenAI access.
- Frontend must call backend APIs only.

## Azure Resource Strategy

The user should manually prepare only:
- Azure account
- Subscription
- Budget
- Resource Group if already created
- Azure OpenAI resource and model deployment if already created
- VS Code Azure login

Copilot should generate Infrastructure-as-Code for the remaining backend resources.

## Resources Copilot Should Create via IaC

Copilot should create Bicep or Terraform for:
- Azure Cosmos DB for NoSQL, serverless
- Cosmos DB database and containers
- Azure Storage Account
- Blob container for recipe images
- Azure Function App
- Function App hosting plan / consumption plan
- Application settings
- Optional Application Insights
- Optional Key Vault for secrets

## Cosmos DB Guidance

Do not create Cosmos DB manually in the Azure Portal unless explicitly needed for experimentation.

Preferred approach:
- Let Copilot generate IaC for Cosmos DB
- Use Cosmos DB serverless
- Create containers defined in data_model.md
- Use partition keys from data_model.md

Expected containers:
- users
- nutritionProfiles
- weights
- nutritionDiaryMeals
- reusableMealItems
- recipes

## Environment Naming Guidance

Use a development-first naming convention, for example:
- Resource group: rg-fittrack-dev
- Function App: func-fittrack-dev
- Cosmos DB account: cosmos-fittrack-dev
- Storage account: stfittrackdev
- Azure OpenAI resource: oai-fittrack-dev

If a different project name is chosen, apply the same pattern consistently.

## Security Notes

Development phase:
- Public network access may be acceptable for Azure OpenAI and development resources, protected by keys/auth.

Before production:
- Restrict network access where appropriate
- Store secrets in Key Vault
- Prefer Managed Identity where feasible
- Review CORS and API access policies
- Ensure no AI keys are exposed to the mobile client

## Copilot Planning Instruction

When planning implementation, Copilot should:
1. Treat Azure OpenAI as already available.
2. Generate IaC for Cosmos DB, Storage, Function App, and related infrastructure.
3. Keep AI provider access behind backend services.
4. Avoid manual portal-only setup steps for resources that should be reproducible.
5. Produce a clear dev deployment path first.
