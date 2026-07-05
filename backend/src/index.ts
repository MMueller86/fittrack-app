import { app } from '@azure/functions';

// Function registrations are imported here.
// Each file in ./functions/ registers its own routes via app.http().
// This file is the single entry point for the Azure Functions runtime.

import './functions/auth';
import './functions/profile';
import './functions/nutritionTargets';
import './functions/weights';
import './functions/diary';
import './functions/reusableItems';
import './functions/recipes';
import './functions/ai';
import './functions/foodEstimate';
import './functions/foodEstimateBatch';
import './functions/labelScan';
import './functions/dashboard';
import './functions/foodSearch';
import './functions/foodProducts';
import './functions/reusableItemsEnrich';
import './functions/reusableItemsEnrichScheduler';
import './functions/dailyInsight';
import './functions/favorites';

// Health check — used in M1 verification
app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => ({
    status: 200,
    jsonBody: { status: 'ok', service: 'fittrack-backend' },
  }),
});
