# Stripe Subscription Server

This server implements a Node.js Express application that handles Stripe subscriptions for AgentCoach.AI. It provides endpoints for creating checkout sessions, handling webhooks, and canceling subscriptions.

## Prerequisites

- Node.js (v14 or later recommended)
- npm (comes with Node.js)
- A Stripe account with API keys

## Installation

1. Clone the repository:

   ```
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a `.env` file in the root directory and add your Stripe secret key and webhook secret:
   ```
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   FRONTEND_URL=your_frontend_url
   ```

## Configuration

The server uses the following environment variables:

- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook secret
- `FRONTEND_URL`: The URL of your frontend application
- `MONGODB_URI` : The MongoDB URI for your database

Make sure these are set in your `.env` file or in your deployment environment.

## API Endpoints

### GET /payments

Retrieves a list of payment intents.

**Response:**

- Success: `{ payments: <payments[]> }`
- Error: `{ error: <error_message> }`

### POST /create-checkout-session

Creates a Stripe Checkout session for subscription plans.

**Request Body:**

- `plan`: The plan type (e.g., "individual" or "team")
- `billingPeriod`: The billing cycle ("monthly" or "annual")

**Response:**

- Success: `{ sessionId: <stripe_session_id> }`
- Error: `{ error: <error_message> }`

### POST /webhook

Handles Stripe webhook events.

**Headers:**

- `stripe-signature`: Stripe signature for webhook verification

**Response:**

- Success: `{ received: true }`
- Error: Appropriate error message

### POST /cancel-subscription

Cancels a Stripe subscription at the end of the current billing period.

**Request Body:**

- `subscriptionId`: The Stripe subscription ID to cancel

**Response:**

- Success: `{ message: <success_message>, cancellationDate: <iso_date_string> }`
- Error: `{ error: <error_message> }`

## Webhook Events

The server handles the following Stripe webhook events:

- `customer.subscription.created`: When a new subscription is created
- `customer.subscription.updated`: When a subscription is updated
- `customer.subscription.deleted`: When a subscription is canceled
- `invoice.payment_succeeded`: When a payment is successful
- `invoice.payment_failed`: When a payment fails

## Error Handling

The server implements error handling for various scenarios:

- Invalid plan or billing cycle in checkout session creation
- Webhook signature verification failures
- Stripe API errors
- Missing subscription ID in cancellation requests

Errors are logged to the console and appropriate error responses are sent to the client.

## TODO Items

The following items need to be implemented:

1. Update user's subscription status in your database when subscription events occur
2. Update user's subscription details in your database when a subscription is updated
3. Update user's payment status in your database when a payment succeeds or fails

## Running the Server

To start the server, run:

```
node server.js
```

The server will start on `http://localhost:3001` by default.

## Testing

To test the webhook functionality locally, you can use tools like ngrok to expose your local server to the internet. Remember to update your webhook URL in the Stripe dashboard when testing.
